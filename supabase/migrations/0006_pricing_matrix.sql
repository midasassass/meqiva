-- Structured pricing. A garage prices each standard service against each vehicle
-- category it serves, so an estimate is computed from what garages actually charge
-- rather than inferred from a single headline figure.

create type vehicle_category as enum ('hatchback','sedan','suv','mpv','motorcycle','scooter','ev');

-- `service_packages.vehicle_category` is a coarse label ('car', 'motorcycle'). The matrix
-- works in fine categories, so each package states exactly which ones it applies to.
-- A brake-pad package should never offer a scooter column.
alter table service_packages
  add column applies_to vehicle_category[] not null
  default '{hatchback,sedan,suv,mpv,motorcycle,scooter,ev}';

-- ───────── The matrix: one row per garage x service x vehicle category ─────────
create table garage_price_matrix (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  package_id int not null references service_packages(id) on delete cascade,
  vehicle_category vehicle_category not null,

  labour_paise bigint not null default 0 check (labour_paise >= 0),
  parts_paise bigint not null default 0 check (parts_paise >= 0),
  consumables_paise bigint not null default 0 check (consumables_paise >= 0),
  gst_rate_bps int not null default 1800 check (gst_rate_bps between 0 and 2800),

  est_minutes int not null default 90 check (est_minutes between 10 and 1440),
  warranty_days int not null default 30 check (warranty_days >= 0),
  note text,

  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),

  unique (garage_id, package_id, vehicle_category),
  -- A priced row has to cost something; a free service is an empty row, not a zero one.
  constraint priced check (not active or labour_paise + parts_paise + consumables_paise > 0)
);
create index on garage_price_matrix (package_id, vehicle_category) where active;
create index on garage_price_matrix (garage_id) where active;

create trigger gpm_touch before update on garage_price_matrix for each row execute function touch_updated_at();

-- ───────── Optional extras priced the same way ─────────
create table addon_catalog (
  id serial primary key,
  slug text unique not null,
  name text not null,
  description text,
  category_id int references service_categories(id),
  active boolean not null default true,
  sort int not null default 0
);

create table garage_addon_prices (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  addon_id int not null references addon_catalog(id) on delete cascade,
  vehicle_category vehicle_category not null,
  price_paise bigint not null check (price_paise >= 0),
  gst_rate_bps int not null default 1800,
  est_minutes int not null default 30,
  active boolean not null default true,
  unique (garage_id, addon_id, vehicle_category)
);
create index on garage_addon_prices (addon_id, vehicle_category) where active;

-- ───────── What people asked to be estimated ─────────
-- Feeds demand analytics and tells a garage which services it has not priced yet.
create table estimate_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  vehicle_category vehicle_category not null,
  model_id int references vehicle_models(id),
  package_ids int[] not null default '{}',
  addon_ids int[] not null default '{}',
  locality text,
  quoted_low_paise bigint,
  quoted_median_paise bigint,
  quoted_high_paise bigint,
  garages_matched int not null default 0,
  converted_booking_id uuid references bookings(id),
  created_at timestamptz not null default now()
);
create index on estimate_requests (created_at desc);
create index on estimate_requests (vehicle_category, created_at desc);

-- ───────── Estimate engine ─────────
-- Per-garage totals for a vehicle category and a set of services. `covered` says how
-- many of the requested services that garage has actually priced, so the caller can
-- separate a complete quote from a partial one instead of silently comparing them.
create or replace function estimate_quotes(
  p_category vehicle_category,
  p_packages int[],
  p_addons int[] default '{}',
  p_locality text default null
)
returns table (
  garage_id uuid, public_name text, slug text, locality text,
  verification verification_level, pickup_drop boolean, accent_hex text,
  covered int, requested int,
  labour_paise bigint, parts_paise bigint, consumables_paise bigint,
  subtotal_paise bigint, tax_paise bigint, total_paise bigint, est_minutes int,
  warranty_days int
)
language sql stable security definer set search_path = public as $$
  with wanted as (
    select coalesce(array_length(p_packages, 1), 0)
         + coalesce(array_length(p_addons, 1), 0) as n
  ),
  priced as (
    select m.garage_id,
           m.labour_paise, m.parts_paise, m.consumables_paise, m.gst_rate_bps,
           m.est_minutes, m.warranty_days
    from garage_price_matrix m
    where m.active and m.vehicle_category = p_category
      and m.package_id = any(p_packages)
    union all
    select a.garage_id, 0, a.price_paise, 0, a.gst_rate_bps, a.est_minutes, 0
    from garage_addon_prices a
    where a.active and a.vehicle_category = p_category
      and a.addon_id = any(p_addons)
  )
  select g.id, g.public_name, g.slug, g.locality, g.verification, g.pickup_drop,
         coalesce(s.accent_hex, '#5b35f0'),
         count(*)::int,
         (select n from wanted),
         sum(p.labour_paise)::bigint,
         sum(p.parts_paise)::bigint,
         sum(p.consumables_paise)::bigint,
         sum(p.labour_paise + p.parts_paise + p.consumables_paise)::bigint,
         sum(round((p.labour_paise + p.parts_paise + p.consumables_paise) * p.gst_rate_bps / 10000.0))::bigint,
         (sum(p.labour_paise + p.parts_paise + p.consumables_paise)
          + sum(round((p.labour_paise + p.parts_paise + p.consumables_paise) * p.gst_rate_bps / 10000.0)))::bigint,
         sum(p.est_minutes)::int,
         min(p.warranty_days)::int
  from priced p
  join garages g on g.id = p.garage_id and g.status = 'active'
  left join garage_settings s on s.garage_id = g.id
  where p_locality is null or g.locality = p_locality
  group by g.id, g.public_name, g.slug, g.locality, g.verification, g.pickup_drop, s.accent_hex
  order by 15;
$$;
grant execute on function estimate_quotes(vehicle_category, int[], int[], text) to anon, authenticated;

-- Market band across garages that cover EVERY requested service. A partial quote never
-- drags the low end down, which is what makes the band honest.
create or replace function market_band(
  p_category vehicle_category,
  p_packages int[],
  p_addons int[] default '{}',
  p_locality text default null
)
returns table (low_paise bigint, median_paise bigint, high_paise bigint, garages int)
language sql stable security definer set search_path = public as $$
  with q as (
    select total_paise, covered, requested
    from estimate_quotes(p_category, p_packages, p_addons, p_locality)
  ),
  full_cover as (select total_paise from q where covered >= requested and requested > 0)
  select min(total_paise)::bigint,
         percentile_cont(0.5) within group (order by total_paise)::bigint,
         max(total_paise)::bigint,
         count(*)::int
  from full_cover;
$$;
grant execute on function market_band(vehicle_category, int[], int[], text) to anon, authenticated;

-- What the market charges for one service, used for a garage's price positioning and
-- for the admin's price intelligence screen.
create or replace function package_rate_card(p_package int)
returns table (
  vehicle_category vehicle_category,
  garages int,
  low_paise bigint, median_paise bigint, high_paise bigint,
  avg_minutes int
)
language sql stable security definer set search_path = public as $$
  select m.vehicle_category,
         count(*)::int,
         min(m.labour_paise + m.parts_paise + m.consumables_paise)::bigint,
         percentile_cont(0.5) within group (order by m.labour_paise + m.parts_paise + m.consumables_paise)::bigint,
         max(m.labour_paise + m.parts_paise + m.consumables_paise)::bigint,
         avg(m.est_minutes)::int
  from garage_price_matrix m
  join garages g on g.id = m.garage_id and g.status = 'active'
  where m.active and m.package_id = p_package
  group by m.vehicle_category
  order by 1;
$$;
grant execute on function package_rate_card(int) to anon, authenticated;

-- How one garage sits against the market, per service it has priced.
create or replace function garage_price_position(p_garage uuid)
returns table (
  package_id int, package_name text, vehicle_category vehicle_category,
  own_paise bigint, market_median_paise bigint, market_garages int, delta_bps int
)
language sql stable security definer set search_path = public as $$
  select m.package_id, sp.name, m.vehicle_category,
         (m.labour_paise + m.parts_paise + m.consumables_paise)::bigint as own_paise,
         r.median_paise,
         r.garages,
         case when coalesce(r.median_paise, 0) = 0 then 0
              else round(((m.labour_paise + m.parts_paise + m.consumables_paise) - r.median_paise)
                         * 10000.0 / r.median_paise)::int end
  from garage_price_matrix m
  join service_packages sp on sp.id = m.package_id
  left join lateral (
    select * from package_rate_card(m.package_id) c where c.vehicle_category = m.vehicle_category
  ) r on true
  where m.garage_id = p_garage and m.active
  order by sp.name, m.vehicle_category;
$$;

-- ───────── RLS ─────────
alter table garage_price_matrix enable row level security;
alter table addon_catalog enable row level security;
alter table garage_addon_prices enable row level security;
alter table estimate_requests enable row level security;

-- Prices a customer is asked to pay are public for an active garage.
create policy gpm_public_read on garage_price_matrix for select
  using (active and exists (select 1 from garages g where g.id = garage_id and g.status = 'active')
         or is_garage_member(garage_id) or is_platform_staff());
create policy gpm_owner_write on garage_price_matrix for all
  using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));

create policy addon_read on addon_catalog for select using (true);
create policy addon_admin on addon_catalog for all using (is_super_admin()) with check (is_super_admin());

create policy gap_public_read on garage_addon_prices for select
  using (active and exists (select 1 from garages g where g.id = garage_id and g.status = 'active')
         or is_garage_member(garage_id) or is_platform_staff());
create policy gap_owner_write on garage_addon_prices for all
  using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));

create policy er_own_read on estimate_requests for select using (user_id = auth.uid() or is_platform_staff());
create policy er_insert on estimate_requests for insert with check (user_id is null or user_id = auth.uid());

-- ───────── Integrity ─────────
-- Refuse a price for a combination the service does not apply to, so the matrix cannot
-- drift into offering a motorcycle service on an MPV.
create or replace function assert_package_applies() returns trigger
language plpgsql as $$
declare v_ok boolean;
begin
  select new.vehicle_category = any(applies_to) into v_ok
  from service_packages where id = new.package_id;
  if not coalesce(v_ok, false) then
    raise exception 'This service is not offered for % vehicles', new.vehicle_category;
  end if;
  return new;
end $$;

create trigger gpm_applies before insert or update on garage_price_matrix
  for each row execute function assert_package_applies();

-- ───────── Track how complete a garage's pricing is ─────────
-- "Possible" counts only the combinations that actually make sense for this garage,
-- so a car-only workshop is not marked incomplete for never pricing a scooter.
create or replace function garage_pricing_coverage(p_garage uuid)
returns table (priced int, possible int, pct int)
language sql stable security definer set search_path = public as $$
  with possible as (
    select count(*)::int n
    from service_packages sp, unnest(sp.applies_to) c
    where sp.active
  ),
  priced as (
    select count(*)::int n from garage_price_matrix where garage_id = p_garage and active
  )
  select priced.n,
         possible.n,
         case when possible.n = 0 then 0
              else least(100, round(priced.n * 100.0 / possible.n)::int) end
  from priced, possible;
$$;
