/*
  Checks every column named in a PostgREST `.select(...)` against the real schema.

  The Supabase client is untyped in this project, so `garages(name)` type-checks happily
  and then returns nulls at runtime. This builds the schema from the migrations (via
  PGlite) and walks the select strings in the source, so that class of mistake fails here
  instead of in front of a customer. Run it with `npm run check:queries`.
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
await db.exec(`
create schema if not exists auth; create schema if not exists extensions;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create role anon; create role authenticated; create role service_role;`);
const mdir = path.join(ROOT, "supabase/migrations");
for (const f of fs.readdirSync(mdir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(fs.readFileSync(path.join(mdir, f), "utf8"));
}

// Columns per relation (tables and views alike — PostgREST reads both).
const cols = new Map();
for (const r of (await db.query(`
  select c.relname rel, a.attname col
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid
  where n.nspname = 'public' and c.relkind in ('r','v','m','p') and a.attnum > 0 and not a.attisdropped
`)).rows) {
  if (!cols.has(r.rel)) cols.set(r.rel, new Set());
  cols.get(r.rel).add(r.col);
}
const fns = new Set((await db.query(
  `select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public'`,
)).rows.map((r) => r.proname));

/* Walk a select string: `a, b, rel(x, y), alias:rel!hint(z)` */
function walk(sel, rel, report) {
  let i = 0, depth = 0, tok = "";
  const flush = (nested) => {
    const t = tok.trim(); tok = "";
    if (!t || nested) return;
    const name = t.split("::")[0].split(":").pop().split("!")[0].trim();
    if (!name || name === "*" || name === "count") return;
    const known = cols.get(rel);
    if (known && !known.has(name)) report(`${rel}.${name}`);
  };
  while (i < sel.length) {
    const ch = sel[i];
    if (ch === "(") {
      if (depth === 0) {
        // `alias:child!hint(...)` — recurse into the child relation
        const head = tok.trim();
        const child = head.split("::")[0].split(":").pop().split("!")[0].trim();
        let d = 1, j = i + 1;
        while (j < sel.length && d > 0) { if (sel[j] === "(") d++; if (sel[j] === ")") d--; j++; }
        const inner = sel.slice(i + 1, j - 1);
        if (cols.has(child)) walk(inner, child, report);
        else report(`${rel} → ${child} (no such relation)`);
        tok = ""; i = j; continue;
      }
      depth++;
    } else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) { flush(false); i++; continue; }
    tok += ch; i++;
  }
  flush(depth > 0);
}

const problems = [];
const files = [];
(function sweep(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".next") sweep(p); }
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
})(path.join(ROOT, "src"));

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const rel = path.relative(ROOT, f);

  // .from("x") ... .select(`...`) within the same statement
  const re = /\.from\(\s*["'`]([a-z_0-9]+)["'`]\s*\)([\s\S]{0,1400}?)\.select\(\s*(`[^`]*`|"[^"]*"|'[^']*')/g;
  let m;
  while ((m = re.exec(src))) {
    const [, table, between, raw] = m;
    if (between.includes(".from(")) continue;
    if (!cols.has(table)) { problems.push(`${rel}: no such table "${table}"`); continue; }
    walk(raw.slice(1, -1).replace(/\s+/g, " "), table, (bad) => problems.push(`${rel}: ${bad}`));
  }

  // .rpc("fn")
  const rp = /\.rpc\(\s*["'`]([a-z_0-9]+)["'`]/g;
  while ((m = rp.exec(src))) {
    if (!fns.has(m[1])) problems.push(`${rel}: no such function "${m[1]}()"`);
  }
}

await db.close();
if (problems.length === 0) {
  console.log(`checked ${files.length} source files against ${cols.size} relations — every column resolves`);
} else {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
