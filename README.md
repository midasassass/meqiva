# MEQIVA

An automotive service marketplace and the workshop operating system behind it. Next.js on Vercel, Postgres with row-level security on Supabase.

The product idea in one line: **the itemised estimate comes first**, and three rules are enforced by the database rather than by goodwill — nothing priced above a printed MRP, no extra work billed without a fresh approval, and verification that can only be earned by audit.

## Run it

```bash
npm install
cp .env.example .env.local          # add your Supabase URL and anon key (+ service role key to seed)
```

In the Supabase SQL editor, run these in order:

```
supabase/migrations/0001_core_schema.sql
supabase/migrations/0002_rls.sql
supabase/migrations/0003_customization.sql
supabase/migrations/0004_operations.sql
supabase/migrations/0005_functions.sql
supabase/migrations/0006_pricing_matrix.sql
supabase/migrations/0007_garage_registration.sql
supabase/migrations/0008_trust_features.sql
supabase/seed.sql
```

Run them in that order and run each file whole — later ones depend on types, helper
functions and tables the earlier ones create. `seed.sql` holds only reference data
(services, credential types, maintenance intervals, inspection packages, FAQs) and is
safe to re-run; it ends with placeholder roadside listings you should replace.

Then:

```bash
npm run seed -- --yes   # optional: demo accounts, four priced garages, bookings and invoices
npm run dev
npm test                # 77 unit tests
npm run check:sql       # runs every migration + seed on a real Postgres, no Supabase needed
npm run check:queries   # checks every .select() column against the real schema
```

Demo logins print from the seed script and share one password. Everything they create is
labelled DEMO and fictional.

`npm run seed` needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. That key bypasses row-level
security: keep it out of client code, out of git, and set it in Vercel as a server-side
environment variable only.

### The two checkers

Both run locally against an in-process Postgres, so neither needs a Supabase project.

- **`npm run check:sql`** applies every migration and the seed to a real engine and reports
  the table count, the policy count and any table without RLS. It then inserts the same
  price rows the seed script writes and proves `market_band()` and `forecast_maintenance()`
  return real numbers from them.
- **`npm run check:queries`** parses every PostgREST `.select()` in `src/` and checks each
  column against the schema the migrations build. The Supabase client is untyped here, so a
  wrong column name compiles fine and then returns nulls in production; this catches it.
  It found thirteen such bugs the first time it ran.

## How a price becomes an estimate

This is the spine of the product.

1. A garage registers through `register_garage()` — the one route that can make a signed-in
   person a garage owner. It refuses a second garage and can never grant a verification level.
2. It then fills the **price matrix**: one row per service, per vehicle class, in
   `garage_price_matrix`. A class left blank is deleted rather than stored as zero, because
   "we do not price this" and "we do this free" are different claims.
3. A customer opens `/estimate`, picks a vehicle and ticks what it needs.
4. `estimate_quotes()` returns every garage that priced *that exact* service and class, and
   `market_band()` returns the spread across them — low, median, high, and how many garages
   stand behind it.

So the figure a customer sees is assembled from rows real workshops published, never from an
average of nothing. Where no garage has priced a combination, the estimator says so rather
than inventing a number.

Garages see where they sit against the median on `/garage/pricing`, and a coverage score
showing what share of the matrix they have filled — a gap there is a search they do not
appear in.

## What a garage can change

Every garage you onboard configures its own workspace, under **Settings**, with no involvement from support:

| Area | What is configurable |
|---|---|
| Branding | Accent colour (contrast is computed, so it can never be unreadable), tagline, workshop description, logo |
| Hours | Opening and closing per day, closed dates |
| Booking rules | Notice period, how far ahead, slot length, buffer, jobs per bay, deposit, cancellation window, no-show fee, pickup radius and fee |
| Pricing | Service catalogue with scope, labour rate cards by skill and vehicle category, default GST, target and warning margin, warranty period |
| Job cards | Custom fields — text, number, dropdown, multi-select, yes/no, date, photo — with required and customer-visible flags |
| Checklists | Inspection checklists per service category, with per-item photo requirements |
| Invoicing | Prefix and numbering, GST registration, place of supply, terms and footer |
| Customer terms | Warranty, cancellation and service terms in the garage's own words |
| Features | Switch off anything the garage does not use |
| Team | Owner, service advisor and technician roles with genuinely different access |

Feature availability resolves as **platform flag AND plan AND the garage's own switch** — any layer can turn something off, none can turn on what the layer above forbids.

## Architecture

| Layer | Choice |
|---|---|
| UI | Next.js 16, React 19, Tailwind v4, Archivo + Source Serif 4 self-hosted from npm |
| Data | Supabase Postgres, RLS on all 71 tables, money as integer paise everywhere |
| Auth | Supabase Auth; platform role on `profiles`, garage role on `garage_members` |
| Gate | `src/proxy.ts` redirects at the edge; RLS does the actual enforcing |
| Logic | `src/lib/*` — pure, unit-tested: MRP, quotes and margin, commission, booking state machine, availability, like-for-like comparison, custom fields, GST, reminders, insights |
| Actions | `src/server/*` — server actions that re-derive everything from the database and never trust submitted totals |

### Rules enforced in the database, not just the interface

- `parts.mrp_ceiling` and `assert_quote_mrp()` refuse any price above a declared MRP; GST is never added on top of a tax-inclusive MRP; blocked attempts are logged to `pricing_violations`.
- `issue_invoice()` refuses to bill extra work with no matching customer approval.
- `customer_approvals` and `audit_logs` are append-only by trigger.
- `transition_booking()` validates every status change against the actor's role and the current status.
- `apply_stock_movement()` locks the row and the CHECK constraint stops stock going negative.
- A GiST exclusion constraint stops two bookings overlapping on the same bay.
- Quotes keep costs and margin; customers read `quote_publications`, an immutable snapshot with every cost field stripped.
- Commission accrues once, on completion, only for `origin = 'marketplace'`.

## Keeping hosting cost near zero

- No ORM and no API server. supabase-js talks to Postgres through PostgREST, and tenant isolation is RLS.
- Marketing pages, `/find` and garage profiles are static or ISR — one database read per revalidation window, not per visitor.
- Almost everything is a Server Component. Only the auth form, quote builder, accent picker, booking form and nav highlight ship JavaScript. No chart or animation library.
- Fonts are self-hosted from npm, so the build needs no network and the first paint needs no third party.
- Fits Vercel Hobby + Supabase Free to start. Move to Vercel Pro and Supabase Pro before commercial launch — Hobby forbids commercial use, and free Supabase projects pause when idle and have no daily backups.

## Integrations

All env-configured, all honest about their state at `/status`: `live`, `sandbox` or `unavailable`. A feature with no credentials says so rather than simulating. Payments, live camera, WhatsApp, SMS, email, maps and the AI layer for Insights are all adapters. The rules-based Insights work with no AI provider at all.

## Needs qualified review before launch

DPDP Act obligations and the privacy notice; Legal Metrology interpretation for MRP on the categories you list; GST invoice format, HSN/SAC and e-invoicing thresholds; the payment-aggregator arrangement and how customer funds are held; camera-privacy consent; and the Terms, Privacy and Grievance pages, which ship as drafts and name a grievance officer who must be appointed. This software implements controls — it does not make the business compliant.
