-- MEQIVA core schema. Money is always integer paise. Timezone: store timestamptz (UTC), render Asia/Kolkata.
-- Supabase installs extensions into the `extensions` schema, not `public`. Without this,
-- gen_random_bytes() and ll_to_earth() below fail to resolve while the migration runs.
set search_path = public, extensions;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists cube;
create extension if not exists earthdistance;
create extension if not exists btree_gist;

-- ───────── Enums ─────────
create type app_role as enum ('customer','garage_owner','service_advisor','technician','super_admin','quality_auditor','support_agent','supplier','fleet_manager');
create type job_origin as enum ('marketplace','walk_in','fleet');
create type booking_status as enum ('requested','awaiting_garage_confirmation','confirmed','vehicle_arrived','inspection_in_progress','awaiting_customer_approval','awaiting_parts','service_in_progress','quality_check','ready_for_delivery','completed','cancelled','disputed');
create type verification_level as enum ('none','listed','verified','quality_assured');
create type garage_status as enum ('pending','active','suspended','rejected');
create type price_source as enum ('manufacturer_indicative','authorized_centre_confirmed','independent_garage_confirmed');
create type payment_status as enum ('created','authorized','captured','failed','refunded','partially_refunded');
create type stock_kind as enum ('inward','outward','adjustment','job_consume','job_return');
create type quote_status as enum ('draft','issued','approved','rejected','superseded');
create type ticket_status as enum ('open','in_progress','awaiting_customer','awaiting_garage','resolved','closed');

-- ───────── Identity & tenancy ─────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'customer',
  full_name text,
  phone text,
  locale text not null default 'en',
  marketing_consent boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table garages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  public_name text not null,
  legal_name text,
  owner_id uuid references profiles(id),
  status garage_status not null default 'pending',
  verification verification_level not null default 'none',
  verified_at timestamptz,
  verification_expires_at timestamptz,
  address text, locality text, city text not null default 'Gurugram', pincode text,
  lat double precision, lng double precision,
  gstin text, phone text, bays_count int not null default 1,
  pickup_drop boolean not null default false,
  supported_categories text[] not null default '{}',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index on garages (city, locality);
create index on garages using gist (ll_to_earth(lat, lng)) where lat is not null;

create table garage_members (
  garage_id uuid not null references garages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role app_role not null check (role in ('garage_owner','service_advisor','technician')),
  created_at timestamptz not null default now(),
  primary key (garage_id, user_id)
);
create index on garage_members (user_id);

-- ───────── Vehicle master & customer vehicles ─────────
create table vehicle_makes (id serial primary key, name text unique not null);
create table vehicle_models (
  id serial primary key, make_id int not null references vehicle_makes(id) on delete cascade,
  name text not null, category text not null check (category in ('hatchback','sedan','suv','mpv','motorcycle','scooter','ev')),
  unique (make_id, name)
);
create table vehicle_variants (
  id serial primary key, model_id int not null references vehicle_models(id) on delete cascade,
  name text not null, fuel text not null, transmission text not null, year_from int, year_to int,
  unique (model_id, name, fuel, transmission)
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  variant_id int references vehicle_variants(id),
  model_id int not null references vehicle_models(id),
  year int, reg_no text, odometer_km int, last_service_on date, last_service_km int,
  warranty_note text, notes text,
  created_at timestamptz not null default now()
);
create index on vehicles (owner_id);
create unique index vehicles_reg_unique on vehicles (upper(reg_no)) where reg_no is not null;

-- ───────── Services & pricing ─────────
create table service_categories (id serial primary key, slug text unique not null, name text not null, requires_diagnosis boolean not null default false);

create table garage_services (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  category_id int not null references service_categories(id),
  name text not null,
  vehicle_category text, make_id int references vehicle_makes(id), model_id int references vehicle_models(id),
  labour_paise bigint not null check (labour_paise >= 0),
  parts_paise bigint not null default 0 check (parts_paise >= 0),
  consumables_paise bigint not null default 0 check (consumables_paise >= 0),
  inspection_fee_paise bigint not null default 0,
  gst_rate_bps int not null default 1800,
  est_minutes int not null default 120,
  warranty_days int not null default 0,
  exclusions text,
  price_source price_source not null default 'independent_garage_confirmed',
  source_effective_on date not null default current_date,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index on garage_services (garage_id, category_id) where active;

-- ───────── Parts & inventory ─────────
create table suppliers (id uuid primary key default gen_random_uuid(), garage_id uuid references garages(id) on delete cascade, name text not null, phone text, email text);

create table parts (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  name text not null, brand text, part_no text,
  mrp_applies boolean not null default false,
  mrp_paise bigint, pack_qty int,
  purchase_paise bigint not null default 0, sell_paise bigint not null default 0,
  gst_rate_bps int not null default 1800,
  stock int not null default 0 check (stock >= 0),
  reorder_at int not null default 2,
  supplier_id uuid references suppliers(id),
  category text check (category in ('genuine','oem','aftermarket','unknown')) default 'unknown',
  created_at timestamptz not null default now(),
  -- Never allow a stored selling price above a declared MRP.
  constraint mrp_ceiling check (not mrp_applies or (mrp_paise is not null and sell_paise <= mrp_paise))
);
create index on parts (garage_id, name);

create table stock_movements (
  id bigint generated always as identity primary key,
  garage_id uuid not null references garages(id) on delete cascade,
  part_id uuid not null references parts(id) on delete cascade,
  kind stock_kind not null, qty int not null, job_card_id uuid,
  note text, actor_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on stock_movements (part_id, created_at desc);

-- ───────── Bays, bookings, jobs ─────────
create table service_bays (id uuid primary key default gen_random_uuid(), garage_id uuid not null references garages(id) on delete cascade, name text not null, active boolean not null default true);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id),
  customer_id uuid references profiles(id),
  vehicle_id uuid references vehicles(id),
  service_id uuid references garage_services(id),
  origin job_origin not null default 'marketplace',
  status booking_status not null default 'requested',
  slot_start timestamptz, slot_end timestamptz,
  bay_id uuid references service_bays(id),
  quoted_total_paise bigint, price_source price_source,
  pickup_requested boolean not null default false,
  customer_note text,
  walk_in_name text, walk_in_phone text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint walkin_has_contact check (origin <> 'walk_in' or walk_in_name is not null or customer_id is not null)
);
create index on bookings (garage_id, status, slot_start);
create index on bookings (customer_id);

-- Prevent two active bookings from overlapping on the same bay.
alter table bookings add constraint no_bay_overlap
  exclude using gist (bay_id with =, tstzrange(slot_start, slot_end) with &&)
  where (bay_id is not null and status not in ('cancelled','completed'));

create table booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references bookings(id) on delete cascade,
  garage_id uuid not null references garages(id),
  from_status booking_status, to_status booking_status not null,
  category text not null default 'status', message text, media_path text,
  actor_id uuid references profiles(id), created_at timestamptz not null default now()
);
create index on booking_events (booking_id, created_at);

create table job_cards (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  booking_id uuid references bookings(id),
  customer_id uuid references profiles(id),
  vehicle_id uuid references vehicles(id),
  origin job_origin not null default 'walk_in',
  complaints text, advisor_notes text, diagnostics text,
  odometer_km int, technician_id uuid references profiles(id),
  checked_in_at timestamptz, started_at timestamptz, completed_at timestamptz,
  qc_passed boolean, created_at timestamptz not null default now()
);
create index on job_cards (garage_id, created_at desc);
create index on job_cards (technician_id) where technician_id is not null;

-- ───────── Quotes, approvals (append-only) ─────────
create table quotes (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  job_card_id uuid references job_cards(id) on delete cascade,
  booking_id uuid references bookings(id),
  version int not null default 1,
  status quote_status not null default 'draft',
  lines jsonb not null default '[]',
  customer_total_paise bigint not null default 0,
  contribution_paise bigint not null default 0,
  extra_work boolean not null default false,
  reject_reason text,
  created_at timestamptz not null default now()
);
create index on quotes (garage_id, status);

create table customer_approvals (
  id bigint generated always as identity primary key,
  quote_id uuid not null references quotes(id),
  garage_id uuid not null references garages(id),
  customer_id uuid not null references profiles(id),
  quote_version int not null, amount_paise bigint not null, scope jsonb not null,
  decision text not null check (decision in ('approved','rejected')),
  decided_at timestamptz not null default now()
);

-- ───────── Money ─────────
create table invoices (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id),
  job_card_id uuid references job_cards(id),
  booking_id uuid references bookings(id),
  number text not null, lines jsonb not null,
  subtotal_paise bigint not null, tax_paise bigint not null, total_paise bigint not null,
  paid_paise bigint not null default 0,
  issued_at timestamptz not null default now(),
  unique (garage_id, number)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid references garages(id), booking_id uuid references bookings(id), invoice_id uuid references invoices(id),
  customer_id uuid references profiles(id),
  provider text not null default 'sandbox', provider_ref text,
  amount_paise bigint not null check (amount_paise > 0),
  status payment_status not null default 'created',
  purpose text not null default 'booking_deposit',
  idempotency_key text unique,
  created_at timestamptz not null default now()
);
create unique index on payments (provider, provider_ref) where provider_ref is not null;

-- Idempotent webhook ingestion: duplicate provider event ids are rejected by the PK.
create table webhook_events (provider text not null, event_id text not null, payload jsonb not null, received_at timestamptz not null default now(), processed_at timestamptz, primary key (provider, event_id));

create table refunds (
  id uuid primary key default gen_random_uuid(), payment_id uuid not null references payments(id),
  amount_paise bigint not null check (amount_paise > 0), status text not null default 'requested',
  provider_ref text unique, reason text, created_at timestamptz not null default now()
);

create table commission_rules (
  id serial primary key, garage_id uuid references garages(id) on delete cascade, category_id int references service_categories(id),
  type text not null check (type in ('fixed','pct_labour','pct_total')),
  amount_paise bigint, rate_bps int, active boolean not null default true
);

create table commission_records (
  id uuid primary key default gen_random_uuid(), garage_id uuid not null references garages(id), booking_id uuid not null unique references bookings(id),
  fee_paise bigint not null, gst_paise bigint not null default 0, created_at timestamptz not null default now()
);

create table subscription_plans (id text primary key, name text not null, price_paise bigint not null, interval text not null default 'month', trial_days int not null default 30, max_users int, max_branches int, features jsonb not null default '{}', active boolean not null default true);
create table subscriptions (id uuid primary key default gen_random_uuid(), garage_id uuid not null references garages(id) on delete cascade, plan_id text not null references subscription_plans(id), status text not null default 'trialing', current_period_end timestamptz, created_at timestamptz not null default now());

-- ───────── Trust, support, ops ─────────
create table reviews (
  id uuid primary key default gen_random_uuid(), garage_id uuid not null references garages(id) on delete cascade,
  booking_id uuid not null unique references bookings(id), customer_id uuid not null references profiles(id),
  rating int not null check (rating between 1 and 5),
  quality int check (quality between 1 and 5), price_transparency int check (price_transparency between 1 and 5),
  timeliness int check (timeliness between 1 and 5), communication int check (communication between 1 and 5),
  remarks text, garage_reply text, flagged boolean not null default false, created_at timestamptz not null default now()
);

create table garage_audits (
  id uuid primary key default gen_random_uuid(), garage_id uuid not null references garages(id) on delete cascade,
  auditor_id uuid references profiles(id), checklist jsonb not null default '{}', findings text,
  result verification_level, valid_until date, created_at timestamptz not null default now()
);

create table support_tickets (
  id uuid primary key default gen_random_uuid(), customer_id uuid references profiles(id), garage_id uuid references garages(id),
  booking_id uuid references bookings(id), category text not null, priority text not null default 'normal',
  description text not null, status ticket_status not null default 'open', assignee_id uuid references profiles(id),
  resolution text, created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade,
  kind text not null, title text not null, body text, read_at timestamptz, created_at timestamptz not null default now()
);
create index on notifications (user_id, created_at desc);

create table camera_sessions (
  id uuid primary key default gen_random_uuid(), garage_id uuid not null references garages(id) on delete cascade,
  booking_id uuid not null references bookings(id), bay_id uuid references service_bays(id),
  consent_at timestamptz, expires_at timestamptz not null, ended_at timestamptz, created_at timestamptz not null default now()
);

create table audit_logs (
  id bigint generated always as identity primary key, actor_id uuid, action text not null, entity text, entity_id text,
  meta jsonb not null default '{}', created_at timestamptz not null default now()
);

create table feature_flags (key text primary key, enabled boolean not null default false, note text);

-- ───────── Triggers & atomic functions ─────────
create or replace function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger bookings_touch before update on bookings for each row execute function touch_updated_at();

-- Append-only guard for approvals and audit logs.
create or replace function forbid_mutation() returns trigger language plpgsql as $$ begin raise exception 'append-only table'; end $$;
create trigger approvals_append_only before update or delete on customer_approvals for each row execute function forbid_mutation();
create trigger audit_append_only before update or delete on audit_logs for each row execute function forbid_mutation();

-- Atomic stock change: row lock + movement log in one transaction. Never lets stock go negative.
create or replace function apply_stock_movement(p_part uuid, p_kind stock_kind, p_qty int, p_job uuid default null, p_note text default null)
returns int language plpgsql security invoker as $$
declare v_delta int; v_stock int; v_garage uuid;
begin
  if p_qty = 0 then raise exception 'qty must be non-zero'; end if;
  v_delta := case p_kind when 'inward' then abs(p_qty) when 'job_return' then abs(p_qty)
                         when 'outward' then -abs(p_qty) when 'job_consume' then -abs(p_qty) else p_qty end;
  select garage_id into v_garage from parts where id = p_part for update;
  if v_garage is null then raise exception 'part not found'; end if;
  update parts set stock = stock + v_delta where id = p_part returning stock into v_stock; -- CHECK blocks negatives
  insert into stock_movements (garage_id, part_id, kind, qty, job_card_id, note, actor_id)
    values (v_garage, p_part, p_kind, v_delta, p_job, p_note, auth.uid());
  return v_stock;
end $$;

-- Auto-create profile on signup (role always starts as customer; elevation is admin-only).
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone) values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.raw_user_meta_data->>'phone');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
