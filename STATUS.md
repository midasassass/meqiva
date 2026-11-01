# MEQIVA — project status

_Last updated: 2026-10-31_

## Verified this round
- **77 unit tests pass** (`npm test`).
- **`tsc --noEmit` clean. `next build` succeeds — 79 routes** (was 64).
- **All eight migrations plus `seed.sql` execute on a real Postgres engine** (`npm run check:sql`,
  PGlite with the five Supabase extensions loaded and a stubbed `auth` schema):
  **86 tables, 185 RLS policies, no table without RLS**, all fifteen trust tables present,
  and `forecast_maintenance(uuid)`, `platform_impact()` and `invite_to_household(uuid,text,boolean)`
  all resolve with the signatures the application calls.
- **Every column in every PostgREST `.select()` resolves** (`npm run check:queries`) —
  153 source files checked against the 86 relations the migrations actually create.

## The two checkers, and why they exist
`npm run check:sql` runs the migrations and the seed against a real Postgres rather than
trusting that they look right. It also inserts the same price rows `scripts/seed.mjs`
writes and asserts that `market_band()` and `forecast_maintenance()` return real numbers
from them — the check that would have caught the pricing matrix being missing from the
seed, which is why garages had nothing to offer.

`npm run check:queries` exists because the Supabase client is untyped here, so
`garages(name)` type-checks happily and then returns nulls at runtime. On its first run it
found **13 such bugs** in the new screens: `garages.name` (the column is `public_name`),
`garages.rating_avg` (no such column — ratings live in `reviews`), three non-existent
`job_cards` columns, and a PostgREST embed written with the alias and the relation the
wrong way round. All fixed. Run both before any deploy.

## Built this round — the fifteen features
| Feature | Where it lives |
|---|---|
| Comparable service baskets | `/estimate`, `/find`, `src/lib/compare.ts` |
| Digital vehicle passport | `/app/vehicles/[id]` + CSV export |
| Repair necessity review | `/app/advice` → `/admin/advice` |
| Before-and-after evidence | `service_evidence`, surfaced on the vehicle page |
| Service cost forecast | `forecast_maintenance()` → vehicle page |
| Verified technician information | `/garage/credentials` → `/admin/credentials` |
| Repair warranty tracker | `/app/warranties`, `/garage/warranties` |
| Live progress timeline | `/app/bookings/[id]` |
| Optional camera access | `camera_sessions` schema; no screen yet |
| Pickup and drop | booking flow and garage settings |
| Second quotation | `/app/second-opinion` → `/garage/leads` |
| Emergency assistance directory | `/assistance` → `/admin/assistance` |
| Pre-owned vehicle inspection | `/app/inspections` → `/admin/inspections` |
| Multi-car family account | `/app/family` |
| Service reminders | `src/lib/reminders.ts`, garage CRM |

**Conversion and clarity.** The home page now carries a fifteen-item feature grid written
in plain English, an impact section counted from the database by `platform_impact()`, and
a testimonials section.

## What the honesty rules mean in the code
- **No invented social proof.** `platform_impact()` counts rows. Any figure still at zero
  is dropped from the page rather than dressed up, and the whole section hides itself when
  there is no activity at all. There is no founding year and no customer count anywhere.
- **Testimonials carry a consent date or they do not publish.** `saveTestimonial` requires
  one. Seeded demonstration rows keep `is_demo = true` and the public page labels each one
  **sample** next to the quote, above a banner saying why.
- **Roadside listings say when they were last checked.** The seeded partners are
  placeholders with unreal numbers, carry no `verified_at`, and the public page therefore
  marks every one "Not yet checked" and shows a warning banner while that is true.
- **A garage cannot verify itself.** `verifyCredential` refuses anyone who is not a
  super admin or quality auditor, and RLS refuses the write regardless.
- **The garage that quoted you never sees the second opinion.** Enforced by RLS on
  `repair_reviews` and by `exclude_garage_id` on `second_quote_requests`, not by UI.

## Not built
1. Payment capture and the webhook route. Adapter, idempotency table and signature
   verification exist and are tested; the provider calls do not.
2. File and photo upload to private storage with signed URLs. `service_evidence` and
   `technician_credentials.document_path` hold the paths; nothing writes them yet, so the
   evidence list shows captions without images.
3. OAuth and phone OTP sign-in.
4. Purchase orders, supplier module, multi-branch UI, fleet accounts, camera sessions —
   schema and RLS in place, screens are not.
5. Voice-to-job-card, notification delivery (outbox table exists, no sender), Hindi.
6. Integration and Playwright end-to-end tests; an automated RLS test suite. Tenant
   isolation rests on policy review and the schema check, not an executing test.

## Known limitations
- **Nothing has run against a live Supabase project.** Auth, RLS in practice,
  `register_garage()` and `scripts/seed.mjs` are all unexercised against real
  infrastructure. This remains the single biggest risk and the first thing worth doing.
- The estimator, `/find` and the forecast show honest empty states until garages publish
  prices. With no seeded data they are bare by design, not broken.
- Hero and verification stamps on marketing pages use clearly-labelled illustrative dates.
  Every live badge renders its own audit dates.
