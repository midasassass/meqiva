import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { cube } from "@electric-sql/pglite/contrib/cube";
import { earthdistance } from "@electric-sql/pglite/contrib/earthdistance";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";

const db = new PGlite({ extensions: { btree_gist, cube, earthdistance, pg_trgm } });
await db.exec(`
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true),'')::uuid $$;
create function gen_random_bytes(n int) returns bytea language sql as $$ select decode(repeat(md5(random()::text), 4), 'hex') $$;
create role anon; create role authenticated;
`);
const dir = "/home/claude/meqiva/supabase/";
for (const f of ["migrations/0001_core_schema.sql","migrations/0002_rls.sql","migrations/0003_customization.sql",
                 "migrations/0004_operations.sql","migrations/0005_functions.sql","migrations/0006_pricing_matrix.sql","seed.sql"]) {
  await db.exec(readFileSync(dir+f,"utf8").replace("create extension if not exists pgcrypto;",""));
}

// Three garages, priced differently. One does not offer the brake job at all.
await db.exec(`
insert into garages (slug, public_name, status, verification, locality, city, bays_count)
values ('a','Alpha Motors','active','quality_assured','Sector 29','Gurugram',2),
       ('b','Beta Auto','active','verified','Sohna Road','Gurugram',3),
       ('c','Gamma Garage','active','listed','Sector 14','Gurugram',1);
`);

const pkgs = await db.query(`select id, slug from service_packages where slug in ('periodic-basic','brake-front') order by slug`);
const brake = pkgs.rows.find(r=>r.slug==='brake-front').id;
const basic = pkgs.rows.find(r=>r.slug==='periodic-basic').id;
const g = Object.fromEntries((await db.query(`select slug,id from garages`)).rows.map(r=>[r.slug,r.id]));

// sedan pricing (paise). Alpha dearest, Gamma cheapest, Beta in between.
await db.exec(`
insert into garage_price_matrix (garage_id, package_id, vehicle_category, labour_paise, parts_paise, consumables_paise, est_minutes, warranty_days) values
 ('${g.a}', ${basic}, 'sedan', 80000, 180000, 10000, 90, 30),
 ('${g.b}', ${basic}, 'sedan', 70000, 165000, 8000, 90, 45),
 ('${g.c}', ${basic}, 'sedan', 55000, 150000, 5000, 75, 15),
 ('${g.a}', ${brake}, 'sedan', 60000, 240000, 0, 90, 60),
 ('${g.b}', ${brake}, 'sedan', 55000, 225000, 0, 80, 60),
 ('${g.a}', ${basic}, 'suv',   100000, 220000, 12000, 120, 30);
`);

const ok = (name, cond, extra="") => console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra?"  "+extra:""}`);

// 1. Single service, sedan: all three garages, ordered cheapest first.
let r = await db.query(`select public_name, total_paise, covered, requested from estimate_quotes('sedan', array[${basic}], '{}', null)`);
ok("single service returns all 3 garages", r.rows.length === 3, JSON.stringify(r.rows.map(x=>x.public_name)));
ok("ordered by total ascending", r.rows[0].public_name === 'Gamma Garage' && r.rows[2].public_name === 'Alpha Motors');
// Gamma: 55000+150000+5000 = 210000 + 18% = 37800 -> 247800
ok("arithmetic incl. GST is exact", Number(r.rows[0].total_paise) === 247800, `got ${r.rows[0].total_paise}`);
ok("covered equals requested", r.rows.every(x=>x.covered===x.requested));

// 2. Two services: Gamma has no brake price, so it is a partial quote.
r = await db.query(`select public_name, total_paise, covered, requested from estimate_quotes('sedan', array[${basic},${brake}], '{}', null)`);
const gamma = r.rows.find(x=>x.public_name==='Gamma Garage');
ok("partial coverage is reported, not hidden", gamma && gamma.covered === 1 && gamma.requested === 2,
   gamma ? `covered ${gamma.covered}/${gamma.requested}` : "missing");

// 3. Band counts only garages covering everything.
r = await db.query(`select * from market_band('sedan', array[${basic},${brake}], '{}', null)`);
ok("band excludes partial quotes", r.rows[0].garages === 2, `garages=${r.rows[0].garages}`);
// Alpha 2-svc: (80000+180000+10000)+(60000+240000)=570000 +18% =102600 -> 672600
// Beta:        (70000+165000+8000)+(55000+225000)=523000 +18% = 94140 -> 617140
ok("band low/high match the two full-cover garages",
   Number(r.rows[0].low_paise) === 617140 && Number(r.rows[0].high_paise) === 672600,
   `${r.rows[0].low_paise}..${r.rows[0].high_paise}`);

// 4. Category actually filters.
r = await db.query(`select count(*)::int n from estimate_quotes('suv', array[${basic}], '{}', null)`);
ok("suv pricing is separate from sedan", r.rows[0].n === 1);
r = await db.query(`select count(*)::int n from estimate_quotes('motorcycle', array[${basic}], '{}', null)`);
ok("unpriced category returns nothing rather than a guess", r.rows[0].n === 0);

// 5. Locality filter.
r = await db.query(`select count(*)::int n from estimate_quotes('sedan', array[${basic}], '{}', 'Sohna Road')`);
ok("locality filter works", r.rows[0].n === 1);

// 6. Add-ons fold into the total.
const addon = (await db.query(`select id from addon_catalog where slug='wheel-alignment'`)).rows[0].id;
await db.exec(`insert into garage_addon_prices (garage_id, addon_id, vehicle_category, price_paise, est_minutes) values ('${g.c}', ${addon}, 'sedan', 50000, 30)`);
r = await db.query(`select total_paise, covered, requested, est_minutes from estimate_quotes('sedan', array[${basic}], array[${addon}], null) where public_name='Gamma Garage'`);
ok("add-on adds to total and to time", Number(r.rows[0].total_paise) === 247800 + 59000 && r.rows[0].est_minutes === 105,
   `${r.rows[0].total_paise} / ${r.rows[0].est_minutes}min`);
ok("add-on counts toward coverage", r.rows[0].covered === 2 && r.rows[0].requested === 2);

// 7. Price positioning for one garage.
r = await db.query(`select package_name, vehicle_category, own_paise, market_median_paise, delta_bps from garage_price_position('${g.a}') order by package_name, vehicle_category`);
const sedanBasic = r.rows.find(x=>x.vehicle_category==='sedan' && x.package_name.includes('Basic'));
// Alpha 270000 vs median of (210000, 243000, 270000) = 243000 -> +11.11% = 1111 bps
ok("positioning computes delta against market median",
   Number(sedanBasic.own_paise) === 270000 && Number(sedanBasic.market_median_paise) === 243000 && sedanBasic.delta_bps === 1111,
   `own ${sedanBasic.own_paise} median ${sedanBasic.market_median_paise} delta ${sedanBasic.delta_bps}bps`);

// 8. A suspended garage drops out of public estimates immediately.
await db.exec(`update garages set status='suspended' where slug='c'`);
r = await db.query(`select count(*)::int n from estimate_quotes('sedan', array[${basic}], '{}', null)`);
ok("suspended garage is excluded", r.rows[0].n === 2);

// 9. Coverage metric.
await db.exec(`update garages set status='active' where slug='c'`);
r = await db.query(`select * from garage_pricing_coverage('${g.a}')`);
ok("coverage reports priced vs possible", r.rows[0].priced === 3 && r.rows[0].possible > 3, JSON.stringify(r.rows[0]));

// 10. The 'priced' constraint rejects an active all-zero row.
try {
  await db.exec(`insert into garage_price_matrix (garage_id, package_id, vehicle_category) values ('${g.b}', ${basic}, 'suv')`);
  ok("all-zero active row rejected", false);
} catch { ok("all-zero active row rejected", true); }

// 11. The integrity trigger refuses a nonsensical combination.
try {
  await db.exec(`insert into garage_price_matrix (garage_id, package_id, vehicle_category, labour_paise)
                 values ('${g.a}', (select id from service_packages where slug='tw-periodic'), 'suv', 50000)`);
  ok("motorcycle service cannot be priced for an SUV", false);
} catch (e) { ok("motorcycle service cannot be priced for an SUV", /not offered for/.test(e.message), e.message.split("\n")[0]); }

// 12. And it allows the sensible one.
await db.exec(`insert into garage_price_matrix (garage_id, package_id, vehicle_category, labour_paise, parts_paise)
               values ('${g.a}', (select id from service_packages where slug='tw-periodic'), 'motorcycle', 30000, 40000)`);
ok("motorcycle service prices fine for a motorcycle", true);
