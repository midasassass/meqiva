-- The trust layer: everything a vehicle owner needs to stop guessing, plus the records
-- a garage and the platform need to stand behind what they claim.

create type review_verdict as enum ('necessary','advisable','can_wait','not_needed','needs_inspection');
create type review_status as enum ('requested','in_review','answered','withdrawn');
create type warranty_kind as enum ('labour','part','platform');
create type assistance_kind as enum ('towing','battery','tyre','fuel','lockout','accident','ev_charge');

-- ───────── Multi-car family account ─────────
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  can_book boolean not null default true,
  can_approve boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index on household_members (user_id);

-- A vehicle may be shared with the household. Ownership never moves.
alter table vehicles add column household_id uuid references households(id) on delete set null;
create index on vehicles (household_id) where household_id is not null;

create or replace function in_household(h uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from household_members where household_id = h and user_id = auth.uid()) $$;

create or replace function household_can_approve(h uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from household_members where household_id = h and user_id = auth.uid() and (can_approve or role = 'owner')) $$;

-- ───────── Verified technician information ─────────
create table credential_types (
  id serial primary key,
  slug text unique not null,
  name text not null,
  issuer text,
  description text,
  sort int not null default 0
);

create table technician_credentials (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  display_name text not null,
  credential_type_id int not null references credential_types(id),
  reference text,
  issued_on date,
  expires_on date,
  years_experience int check (years_experience between 0 and 60),
  document_path text,
  -- Only a MEQIVA auditor sets these. A garage can claim; it cannot verify itself.
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on technician_credentials (garage_id) where active;

-- ───────── Repair warranty tracker ─────────
create table warranties (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  job_card_id uuid references job_cards(id) on delete set null,
  invoice_id uuid references invoices(id) on delete set null,
  vehicle_id uuid references vehicles(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  kind warranty_kind not null default 'labour',
  -- Who actually honours it. Usually the garage; for a part, the manufacturer.
  provider_name text not null,
  covers text not null,
  excludes text,
  starts_on date not null default current_date,
  expires_on date,
  km_limit int check (km_limit is null or km_limit > 0),
  odometer_at_start int,
  reference text,
  created_at timestamptz not null default now(),
  check (expires_on is null or expires_on >= starts_on)
);
create index on warranties (customer_id, expires_on);
create index on warranties (vehicle_id);

create table warranty_claims (
  id uuid primary key default gen_random_uuid(),
  warranty_id uuid not null references warranties(id) on delete cascade,
  customer_id uuid not null references profiles(id) on delete cascade,
  description text not null check (length(description) between 10 and 4000),
  odometer_km int,
  status text not null default 'open' check (status in ('open','accepted','declined','resolved')),
  resolution text,
  created_at timestamptz not null default now()
);

-- ───────── Repair necessity review — independent advice before authorising ─────────
create table repair_reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete set null,
  booking_id uuid references bookings(id) on delete set null,
  publication_id uuid references quote_publications(id) on delete set null,
  question text not null check (length(question) between 10 and 4000),
  quoted_total_paise bigint,
  status review_status not null default 'requested',
  -- Answered by a MEQIVA quality auditor, never by the garage that quoted.
  reviewer_id uuid references profiles(id),
  verdict review_verdict,
  rationale text,
  suggested_scope jsonb,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index on repair_reviews (status, created_at) where status in ('requested','in_review');
create index on repair_reviews (customer_id, created_at desc);

-- ───────── Second quotation ─────────
create table second_quote_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete set null,
  publication_id uuid references quote_publications(id) on delete set null,
  -- The garage that quoted first is excluded from responding, so this is genuinely second.
  exclude_garage_id uuid references garages(id) on delete set null,
  scope text not null check (length(scope) between 5 and 2000),
  vehicle_category text,
  original_total_paise bigint,
  status text not null default 'open' check (status in ('open','closed','expired')),
  closes_at timestamptz not null default now() + interval '72 hours',
  created_at timestamptz not null default now()
);
create index on second_quote_requests (status, closes_at);

create table second_quote_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references second_quote_requests(id) on delete cascade,
  garage_id uuid not null references garages(id) on delete cascade,
  total_paise bigint not null check (total_paise > 0),
  lines jsonb not null default '[]',
  note text,
  est_minutes int,
  warranty_days int,
  valid_until timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  unique (request_id, garage_id)
);

-- ───────── Emergency assistance directory ─────────
create table assistance_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kinds assistance_kind[] not null default '{}',
  phone text not null,
  whatsapp text,
  city text not null default 'Gurugram',
  localities text[] not null default '{}',
  hours text not null default '24 hours',
  notes text,
  -- MEQIVA has checked the number answers and the business exists. Nothing more is implied.
  verified_at timestamptz,
  active boolean not null default true,
  sort int not null default 0
);
create index on assistance_partners (city) where active;

-- ───────── Pre-owned vehicle inspection ─────────
create table inspection_packages (
  id serial primary key,
  slug text unique not null,
  name text not null,
  description text,
  vehicle_category text,
  checkpoints int not null default 100,
  price_paise bigint not null check (price_paise >= 0),
  duration_minutes int not null default 90,
  active boolean not null default true
);

create table inspection_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  garage_id uuid references garages(id) on delete set null,
  package_id int not null references inspection_packages(id),
  vehicle_description text not null,
  registration text,
  seller_contact text,
  inspect_at text,
  scheduled_for timestamptz,
  status text not null default 'requested'
    check (status in ('requested','scheduled','in_progress','reported','cancelled')),
  price_paise bigint not null default 0,
  created_at timestamptz not null default now()
);
create index on inspection_orders (customer_id, created_at desc);

create table inspection_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references inspection_orders(id) on delete cascade,
  garage_id uuid references garages(id) on delete set null,
  inspector_name text,
  -- [{ section, items: [{ label, status, note, media_path }] }]
  sections jsonb not null default '[]',
  overall_grade text check (overall_grade in ('A','B','C','D')),
  headline text,
  estimated_spend_paise bigint,
  recommendation text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────── Manufacturer guidance, for the cost forecast ─────────
create table maintenance_schedules (
  id serial primary key,
  vehicle_category text not null,
  package_id int not null references service_packages(id) on delete cascade,
  every_months int check (every_months is null or every_months > 0),
  every_km int check (every_km is null or every_km > 0),
  from_km int not null default 0,
  note text,
  active boolean not null default true,
  check (every_months is not null or every_km is not null)
);
create index on maintenance_schedules (vehicle_category) where active;

-- ───────── Testimonials and impact, for the public site ─────────
create table testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_context text,
  quote text not null check (length(quote) between 20 and 600),
  rating int check (rating between 1 and 5),
  city text,
  -- Where it came from, so nothing is published without a stated provenance.
  source text not null default 'written' check (source in ('platform_review','interview','written')),
  booking_id uuid references bookings(id) on delete set null,
  garage_id uuid references garages(id) on delete set null,
  consent_on date,
  published boolean not null default false,
  is_demo boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index on testimonials (published, sort) where published;

-- ───────── Functions ─────────

-- What this vehicle is likely to need next, and what the market charges for it.
create or replace function forecast_maintenance(p_vehicle uuid)
returns table (
  package_id int, package_name text, due_reason text, due_on date,
  low_paise bigint, median_paise bigint, high_paise bigint, garages int
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_cat text; v_last date; v_last_km int; v_odo int; v_daily numeric;
begin
  select vm.category, v.last_service_on, v.last_service_km, v.odometer_km
    into v_cat, v_last, v_last_km, v_odo
  from vehicles v join vehicle_models vm on vm.id = v.model_id
  where v.id = p_vehicle and (v.owner_id = auth.uid()
        or (v.household_id is not null and in_household(v.household_id)));
  if v_cat is null then return; end if;

  -- Rough daily usage from the gap since the last recorded service.
  v_daily := case
    when v_last is not null and v_odo is not null and v_last_km is not null
         and v_odo > v_last_km and current_date > v_last
      then (v_odo - v_last_km)::numeric / greatest(1, current_date - v_last)
    else 30 end;

  return query
  select ms.package_id,
         sp.name,
         case
           when ms.every_km is not null and v_odo is not null and v_last_km is not null
                and (v_odo - v_last_km) >= ms.every_km then 'Overdue on distance'
           when ms.every_months is not null and v_last is not null
                and v_last + (ms.every_months || ' months')::interval <= current_date then 'Overdue on time'
           when ms.every_km is not null then 'Due by distance'
           else 'Due by date' end,
         case
           when ms.every_months is not null and v_last is not null
             then (v_last + (ms.every_months || ' months')::interval)::date
           when ms.every_km is not null and v_odo is not null and v_last_km is not null
             then (current_date + (greatest(0, ms.every_km - (v_odo - v_last_km)) / greatest(v_daily, 1))::int)
           else current_date + 180 end,
         b.low_paise, b.median_paise, b.high_paise, b.garages
  from maintenance_schedules ms
  join service_packages sp on sp.id = ms.package_id
  left join lateral market_band(v_cat::vehicle_category, array[ms.package_id]) b on true
  where ms.active and ms.vehicle_category = v_cat
    and coalesce(v_odo, 0) >= ms.from_km
  order by 4;
end $$;
grant execute on function forecast_maintenance(uuid) to authenticated;

-- Real platform numbers for the marketing site. Aggregate only, no identities.
create or replace function platform_impact()
returns table (
  services_completed bigint, garages_active bigint, garages_verified bigint,
  vehicles_tracked bigint, quotes_compared bigint, approvals_recorded bigint,
  mrp_blocks bigint, median_saving_bps int
)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from bookings where status = 'completed'),
    (select count(*) from garages where status = 'active'),
    (select count(*) from garages where status = 'active' and verification in ('verified','quality_assured')),
    (select count(*) from vehicles),
    (select count(*) from quote_publications),
    (select count(*) from customer_approvals),
    (select count(*) from pricing_violations),
    -- Spread between the cheapest and the typical comparable quote, where there is one.
    coalesce((
      select round(avg(case when median_paise > 0
                            then (median_paise - low_paise) * 10000.0 / median_paise else 0 end))::int
      from (
        select (market_band(m.vehicle_category, array[m.package_id])).*
        from (select distinct package_id, vehicle_category from garage_price_matrix where active) m
      ) s where s.garages >= 2
    ), 0)
$$;
grant execute on function platform_impact() to anon, authenticated;

-- ───────── RLS ─────────
do $$ declare t text; begin
  foreach t in array array['households','household_members','credential_types','technician_credentials',
    'warranties','warranty_claims','repair_reviews','second_quote_requests','second_quote_responses',
    'assistance_partners','inspection_packages','inspection_orders','inspection_reports',
    'maintenance_schedules','testimonials'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

create policy hh_read on households for select using (in_household(id) or created_by = auth.uid() or is_platform_staff());
create policy hh_create on households for insert with check (created_by = auth.uid());
create policy hh_owner on households for update using (
  exists (select 1 from household_members m where m.household_id = id and m.user_id = auth.uid() and m.role = 'owner'))
  with check (true);

create policy hm_read on household_members for select using (in_household(household_id) or is_platform_staff());
create policy hm_owner_write on household_members for all using (
  exists (select 1 from household_members m where m.household_id = household_members.household_id
          and m.user_id = auth.uid() and m.role = 'owner'))
  with check (
  exists (select 1 from household_members m where m.household_id = household_members.household_id
          and m.user_id = auth.uid() and m.role = 'owner'));
-- The first member of a new household is its creator.
create policy hm_bootstrap on household_members for insert with check (
  user_id = auth.uid() and role = 'owner'
  and exists (select 1 from households h where h.id = household_id and h.created_by = auth.uid()));

-- A shared vehicle is visible to the household, but only the owner may change it.
create policy vehicles_household_read on vehicles for select
  using (household_id is not null and in_household(household_id));

create policy credtype_read on credential_types for select using (true);
create policy credtype_admin on credential_types for all using (is_super_admin()) with check (is_super_admin());

-- Credentials are public once an auditor has verified them; unverified claims stay internal.
create policy cred_public_read on technician_credentials for select using (
  (verified_at is not null and active
   and exists (select 1 from garages g where g.id = garage_id and g.status = 'active'))
  or is_garage_member(garage_id) or is_platform_staff());
create policy cred_garage_write on technician_credentials for insert with check (is_garage_manager(garage_id));
create policy cred_garage_update on technician_credentials for update using (is_garage_manager(garage_id))
  with check (is_garage_manager(garage_id) and verified_at is null);
create policy cred_auditor on technician_credentials for all
  using (auth_role() in ('super_admin','quality_auditor')) with check (auth_role() in ('super_admin','quality_auditor'));

create policy warr_read on warranties for select using (
  customer_id = auth.uid() or is_garage_member(garage_id) or is_platform_staff()
  or exists (select 1 from vehicles v where v.id = vehicle_id and v.household_id is not null and in_household(v.household_id)));
create policy warr_garage_write on warranties for all using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));

create policy wclaim_read on warranty_claims for select using (
  customer_id = auth.uid() or is_platform_staff()
  or exists (select 1 from warranties w where w.id = warranty_id and is_garage_member(w.garage_id)));
create policy wclaim_insert on warranty_claims for insert with check (customer_id = auth.uid());
create policy wclaim_garage_update on warranty_claims for update using (
  exists (select 1 from warranties w where w.id = warranty_id and is_garage_manager(w.garage_id)) or is_platform_staff())
  with check (true);

-- A review is between the customer and MEQIVA. The garage that quoted never sees it.
create policy rr_customer on repair_reviews for select using (customer_id = auth.uid());
create policy rr_customer_insert on repair_reviews for insert with check (customer_id = auth.uid() and status = 'requested');
create policy rr_customer_withdraw on repair_reviews for update using (customer_id = auth.uid() and status in ('requested','in_review'))
  with check (customer_id = auth.uid());
create policy rr_staff on repair_reviews for all
  using (auth_role() in ('super_admin','quality_auditor')) with check (auth_role() in ('super_admin','quality_auditor'));

-- An open request is visible to any active garage that could answer it, except the one excluded.
create policy sqr_customer on second_quote_requests for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy sqr_garage_read on second_quote_requests for select using (
  status = 'open' and closes_at > now()
  and exists (select 1 from garage_members gm join garages g on g.id = gm.garage_id
              where gm.user_id = auth.uid() and g.status = 'active'
                and (exclude_garage_id is null or g.id <> exclude_garage_id)));
create policy sqr_staff on second_quote_requests for select using (is_platform_staff());

create policy sqres_customer_read on second_quote_responses for select using (
  exists (select 1 from second_quote_requests r where r.id = request_id and r.customer_id = auth.uid()));
create policy sqres_garage on second_quote_responses for all using (is_garage_manager(garage_id)) with check (
  is_garage_manager(garage_id)
  and exists (select 1 from second_quote_requests r where r.id = request_id
              and r.status = 'open' and r.closes_at > now()
              and (r.exclude_garage_id is null or r.exclude_garage_id <> garage_id)));

create policy assist_public on assistance_partners for select using (active or is_platform_staff());
create policy assist_admin on assistance_partners for all using (is_super_admin()) with check (is_super_admin());

create policy ipkg_public on inspection_packages for select using (active or is_platform_staff());
create policy ipkg_admin on inspection_packages for all using (is_super_admin()) with check (is_super_admin());

create policy iord_customer on inspection_orders for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy iord_garage on inspection_orders for select using (is_garage_member(garage_id) or is_platform_staff());
create policy iord_garage_update on inspection_orders for update using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));

create policy irep_read on inspection_reports for select using (
  (published_at is not null and exists (select 1 from inspection_orders o where o.id = order_id and o.customer_id = auth.uid()))
  or is_garage_member(garage_id) or is_platform_staff());
create policy irep_garage on inspection_reports for all using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));

create policy msched_read on maintenance_schedules for select using (true);
create policy msched_admin on maintenance_schedules for all using (is_super_admin()) with check (is_super_admin());

create policy testi_public on testimonials for select using (published or is_platform_staff());
create policy testi_admin on testimonials for all using (is_super_admin()) with check (is_super_admin());

-- Adding someone to a family account needs an email lookup, but email lives in auth.users
-- and must stay private. This function does the lookup without ever returning the address,
-- and only the household owner can call it. It reveals nothing about addresses that are
-- not already on the platform beyond "no account", which the caller must be told anyway.
create or replace function invite_to_household(p_household uuid, p_email text, p_can_approve boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not exists (
    select 1 from household_members
    where household_id = p_household and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only the owner of this account can add people';
  end if;

  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then return 'no_account'; end if;
  if v_user = auth.uid() then return 'self'; end if;

  insert into household_members (household_id, user_id, role, can_book, can_approve)
  values (p_household, v_user, 'member', true, coalesce(p_can_approve, false))
  on conflict (household_id, user_id) do nothing;

  return 'added';
end $$;
revoke all on function invite_to_household(uuid, text, boolean) from anon;
grant execute on function invite_to_household(uuid, text, boolean) to authenticated;
