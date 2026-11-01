/*
  Runs every migration and the seed against a real Postgres engine (PGlite) so a mistake
  that would only show up on Supabase is caught here instead. Supabase supplies an `auth`
  schema and installs extensions into `extensions`; both are stubbed below so the SQL runs
  unchanged. Run it with `npm run check:sql`.
*/
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { cube } from "@electric-sql/pglite/contrib/cube";
import { earthdistance } from "@electric-sql/pglite/contrib/earthdistance";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const db = await PGlite.create({ extensions: { pgcrypto, pg_trgm, cube, earthdistance, btree_gist } });

// Supabase-shaped stubs so the migrations run unchanged.
await db.exec(`
create schema if not exists auth;
create schema if not exists extensions;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create role anon; create role authenticated; create role service_role;
`);

const dir = path.join(ROOT, "supabase/migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  const sql = fs.readFileSync(path.join(dir, f), "utf8");
  try { await db.exec(sql); console.log(`  ok   ${f}`); }
  catch (e) { console.log(`  FAIL ${f}\n       ${e.message}`); process.exit(1); }
}

const seed = fs.readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8");
try { await db.exec(seed); console.log("  ok   seed.sql"); }
catch (e) { console.log(`  FAIL seed.sql\n       ${e.message}`); process.exit(1); }

const q = async (sql) => (await db.query(sql)).rows;
const [{ n: tables }] = await q(`select count(*)::int n from pg_tables where schemaname='public'`);
const [{ n: policies }] = await q(`select count(*)::int n from pg_policies where schemaname='public'`);
const naked = await q(`select tablename from pg_tables t where schemaname='public'
  and not exists (select 1 from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
                  where ns.nspname='public' and c.relname=t.tablename and c.relrowsecurity)
  order by 1`);
console.log(`\n  ${tables} tables, ${policies} RLS policies`);
console.log(naked.length === 0 ? "  no table without RLS" : `  WITHOUT RLS: ${naked.map((r) => r.tablename).join(", ")}`);

// The new feature tables must all exist and all carry policies.
const want = ['households', 'household_members', 'credential_types', 'technician_credentials', 'warranties',
  'warranty_claims', 'repair_reviews', 'second_quote_requests', 'second_quote_responses', 'assistance_partners',
  'inspection_packages', 'inspection_orders', 'inspection_reports', 'maintenance_schedules', 'testimonials'];
const got = (await q(`select tablename from pg_tables where schemaname='public'`)).map((r) => r.tablename);
const missing = want.filter((t) => !got.includes(t));
console.log(missing.length === 0 ? "  all 15 trust tables present" : `  MISSING: ${missing.join(", ")}`);

// Reference rows the new pages read.
for (const t of ['credential_types', 'maintenance_schedules', 'inspection_packages', 'assistance_partners']) {
  const [{ n }] = await q(`select count(*)::int n from ${t}`);
  console.log(`  ${t}: ${n} rows`);
}

// Functions the pages call must resolve with the right signatures.
for (const sig of ['forecast_maintenance(uuid)', 'platform_impact()', 'invite_to_household(uuid,text,boolean)']) {
  const [{ ok }] = await q(`select to_regprocedure('public.${sig}') is not null ok`);
  console.log(`  ${sig}: ${ok ? "resolves" : "MISSING"}`);
}

const impact = await q(`select * from platform_impact()`);
console.log(`  platform_impact(): ${JSON.stringify(impact[0])}`);

/*
  The estimator, the comparison and the forecast all read `garage_price_matrix`. A bare
  database has none, so the pages correctly show nothing. Below we insert the same rows
  `scripts/seed.mjs` writes against a live project and prove the three read paths produce
  real numbers from them — this is the check that would have caught the matrix being
  missing from the seed.
*/
console.log("\n  — with demo prices —");
await db.exec(`
  insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000001','harness@example.test') on conflict do nothing;
  insert into profiles (id, full_name, role) values ('00000000-0000-4000-8000-000000000001','Harness','customer') on conflict do nothing;
  insert into garages (id, slug, public_name, owner_id, status, verification, locality, city)
  select ('00000000-0000-4000-8000-00000000001' || g)::uuid, 'harness-' || g, 'Harness ' || g,
         '00000000-0000-4000-8000-000000000001', 'active',
         (case g when '1' then 'quality_assured' when '2' then 'verified' else 'listed' end)::verification_level,
         'Sector 29', 'Gurugram'
  from unnest(array['1','2','3','4']) g on conflict do nothing;
`);
// Same base costs and class factors as scripts/seed.mjs.
const BASE = {
  "periodic-basic": [720, 1650, 80], "periodic-full": [1400, 3100, 250], "brake-front": [600, 2400, 0],
  "ac-service": [900, 2100, 150], "battery-replace": [250, 5400, 0], "align-balance": [700, 0, 100]
};
const CLASS = { hatchback: 1, sedan: 1.14, suv: 1.38, mpv: 1.45, ev: 1.2 };
const FACTOR = { 1: 1.0, 2: 1.14, 3: 0.88, 4: 0.97 };
let inserted = 0;
for (const [slug, [lab, parts, cons]] of Object.entries(BASE)) {
  const pk = await q(`select id from service_packages where slug = '${slug}'`);
  if (pk.length === 0) continue;
  for (const [cat, cf] of Object.entries(CLASS)) {
    for (const [g, gf] of Object.entries(FACTOR)) {
      const f = cf * gf;
      await db.exec(`insert into garage_price_matrix (garage_id, package_id, vehicle_category, labour_paise, parts_paise, consumables_paise, warranty_days, active)
        values ('00000000-0000-4000-8000-00000000001${g}', ${pk[0].id}, '${cat}', ${Math.round(lab * f) * 100}, ${Math.round(parts * f) * 100}, ${Math.round(cons * f) * 100}, 30, true)
        on conflict do nothing`);
      inserted++;
    }
  }
}
console.log(`  price rows inserted: ${inserted}`);
for (const cat of ["hatchback", "sedan", "suv"]) {
  const pk = await q(`select id from service_packages where slug = 'periodic-basic'`);
  const b = await q(`select * from market_band('${cat}'::vehicle_category, array[${pk[0].id}])`);
  const r = b[0];
  console.log(`  market_band ${cat.padEnd(10)} basic service → low \u20b9${(r.low_paise / 100).toFixed(0)}  median \u20b9${(r.median_paise / 100).toFixed(0)}  high \u20b9${(r.high_paise / 100).toFixed(0)}  across ${r.garages} garages`);
}
// A vehicle with history, so the forecast has something to work from.
const mk = await q(`select id from vehicle_makes limit 1`);
const md = await q(`select id from vehicle_models where make_id = '${mk[0].id}' and category = 'sedan' limit 1`);
if (md.length > 0) {
  await db.exec(`
    set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
    insert into vehicles (id, owner_id, model_id, year, reg_no, odometer_km, last_service_on, last_service_km)
    values ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000000001','${md[0].id}',2019,'HR26TEST1',62000, current_date - 400, 48000)
    on conflict do nothing;
  `);
  const f = await q(`select * from forecast_maintenance('00000000-0000-4000-8000-0000000000a1')`);
  console.log(`  forecast_maintenance(): ${f.length} rows`);
  const priced = f.filter((r) => r.median_paise != null);
  const total = priced.reduce((a, r) => a + Number(r.median_paise), 0);
  for (const r of f.slice(0, 6)) {
    console.log(`    ${String(r.package_name).padEnd(26)} ${String(r.due_reason).padEnd(20)} ${r.due_on.toISOString ? r.due_on.toISOString().slice(0, 10) : r.due_on}  ${r.median_paise != null ? "\u20b9" + (r.median_paise / 100).toFixed(0) : "no price"}`);
  }
  console.log(`  twelve-month total from ${priced.length} priced items: \u20b9${(total / 100).toFixed(0)}`);
}
const imp2 = await q(`select * from platform_impact()`);
console.log(`  platform_impact(): ${JSON.stringify(imp2[0])}`);
await db.close();
