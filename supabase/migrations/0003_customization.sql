-- Per-garage customization. Every garage onboarded gets its own branding, hours,
-- job-card fields, checklists, rate cards, booking rules, tax/invoice setup and feature set.

create type field_type as enum ('text','textarea','number','select','multiselect','boolean','date','photo');
create type field_entity as enum ('job_card','customer','vehicle','booking');
create type day_of_week as enum ('mon','tue','wed','thu','fri','sat','sun');

-- ───────── 1:1 settings per garage ─────────
create table garage_settings (
  garage_id uuid primary key references garages(id) on delete cascade,

  -- Branding (applied to their public profile, booking microsite and own dashboard chrome)
  accent_hex text not null default '#0E5157' check (accent_hex ~* '^#[0-9a-f]{6}$'),
  logo_url text, cover_url text,
  tagline text check (tagline is null or length(tagline) <= 120),
  about text check (about is null or length(about) <= 2000),

  -- Locale / presentation
  locale text not null default 'en' check (locale in ('en','hi')),
  timezone text not null default 'Asia/Kolkata',

  -- Booking rules
  online_booking boolean not null default true,
  min_lead_minutes int not null default 120 check (min_lead_minutes >= 0),
  max_advance_days int not null default 30 check (max_advance_days between 1 and 365),
  slot_minutes int not null default 30 check (slot_minutes in (15,30,60)),
  buffer_minutes int not null default 15 check (buffer_minutes >= 0),
  concurrent_jobs_per_bay int not null default 1 check (concurrent_jobs_per_bay between 1 and 5),
  auto_confirm boolean not null default false,
  deposit_bps int not null default 0 check (deposit_bps between 0 and 10000),
  cancellation_window_hours int not null default 6 check (cancellation_window_hours >= 0),
  no_show_fee_paise bigint not null default 0 check (no_show_fee_paise >= 0),

  -- Pickup & drop
  pickup_enabled boolean not null default false,
  pickup_fee_paise bigint not null default 0 check (pickup_fee_paise >= 0),
  pickup_radius_km numeric(5,1) not null default 5 check (pickup_radius_km >= 0),

  -- Tax & invoicing
  gst_registered boolean not null default false,
  place_of_supply_code text default '06',          -- Haryana
  default_gst_bps int not null default 1800,
  invoice_prefix text not null default 'INV' check (invoice_prefix ~ '^[A-Z0-9/-]{1,10}$'),
  invoice_next_seq int not null default 1 check (invoice_next_seq >= 1),
  invoice_terms text,
  invoice_footer text,

  -- Commercial defaults used by the quote builder
  default_labour_rate_paise bigint not null default 60000 check (default_labour_rate_paise >= 0),
  target_margin_bps int not null default 3000 check (target_margin_bps between 0 and 10000),
  low_margin_alert_bps int not null default 1000 check (low_margin_alert_bps between 0 and 10000),
  default_warranty_days int not null default 30 check (default_warranty_days >= 0),

  -- Per-garage feature switches. Effective set = platform flag AND plan AND this.
  features jsonb not null default '{}'::jsonb,

  -- Notification channels the garage wants to use (needs platform credentials too)
  notify_channels text[] not null default array['in_app'],

  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

create or replace function ensure_garage_settings() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into garage_settings (garage_id) values (new.id) on conflict do nothing;
  insert into garage_branches (garage_id, name, is_primary) values (new.id, new.public_name, true) on conflict do nothing;
  return new;
end $$;

-- ───────── Branches ─────────
create table garage_branches (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  name text not null,
  address text, locality text, city text, pincode text,
  lat double precision, lng double precision,
  phone text,
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index one_primary_branch on garage_branches (garage_id) where is_primary;
create index on garage_branches (garage_id) where active;

create trigger garages_bootstrap after insert on garages for each row execute function ensure_garage_settings();

-- ───────── Working hours & holidays ─────────
create table garage_hours (
  id bigint generated always as identity primary key,
  garage_id uuid not null references garages(id) on delete cascade,
  branch_id uuid references garage_branches(id) on delete cascade,
  day day_of_week not null,
  opens time not null,
  closes time not null,
  closed boolean not null default false,
  check (closed or closes > opens),
  unique (garage_id, branch_id, day)
);

create table garage_holidays (
  id bigint generated always as identity primary key,
  garage_id uuid not null references garages(id) on delete cascade,
  on_date date not null,
  reason text,
  unique (garage_id, on_date)
);

-- ───────── Custom fields: each garage shapes its own job card ─────────
create table garage_field_defs (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  entity field_entity not null default 'job_card',
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,38}$'),
  label text not null,
  help text,
  type field_type not null default 'text',
  options text[] not null default '{}',
  required boolean not null default false,
  show_to_customer boolean not null default false,
  sort int not null default 0,
  active boolean not null default true,
  unique (garage_id, entity, key)
);
create index on garage_field_defs (garage_id, entity) where active;

alter table job_cards add column custom jsonb not null default '{}'::jsonb;
alter table vehicles  add column custom jsonb not null default '{}'::jsonb;

-- ───────── Inspection checklists, per garage and per service category ─────────
create table garage_checklists (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  name text not null,
  category_id int references service_categories(id),
  require_photo boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table garage_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references garage_checklists(id) on delete cascade,
  label text not null,
  help text,
  require_photo boolean not null default false,
  sort int not null default 0
);
create index on garage_checklist_items (checklist_id, sort);

-- ───────── Labour rate cards (per skill / per vehicle category) ─────────
create table garage_labour_rates (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  name text not null,
  vehicle_category text,
  rate_per_hour_paise bigint not null check (rate_per_hour_paise >= 0),
  is_default boolean not null default false,
  active boolean not null default true
);
create unique index one_default_rate on garage_labour_rates (garage_id) where is_default;

-- ───────── Service packages: the platform defines canonical scope, garages price it ─────────
create table service_packages (
  id serial primary key,
  category_id int not null references service_categories(id),
  slug text unique not null,
  name text not null,
  vehicle_category text,
  -- Canonical items a quote must cover to be ranked as like-for-like.
  required_items text[] not null default '{}',
  optional_items text[] not null default '{}',
  typical_minutes int not null default 120,
  active boolean not null default true
);

alter table garage_services add column package_id int references service_packages(id);
alter table garage_services add column included_items text[] not null default '{}';
alter table garage_services add column branch_id uuid references garage_branches(id);
alter table garage_services add column description text;

-- ───────── Per-garage terms & warranty text ─────────
create table garage_terms (
  garage_id uuid primary key references garages(id) on delete cascade,
  warranty_policy text,
  cancellation_policy text,
  service_terms text,
  updated_at timestamptz not null default now()
);

-- ───────── Per-garage notification templates ─────────
create table garage_templates (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  event text not null,
  channel text not null check (channel in ('in_app','email','sms','whatsapp')),
  subject text,
  body text not null,
  active boolean not null default true,
  unique (garage_id, event, channel)
);

-- ───────── Technician skills, so scheduling can respect capability ─────────
create table garage_skills (id serial primary key, name text unique not null);
create table technician_skills (
  garage_id uuid not null references garages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  skill_id int not null references garage_skills(id) on delete cascade,
  primary key (garage_id, user_id, skill_id)
);

-- ───────── RLS ─────────
do $$ declare t text; begin
  foreach t in array array['garage_settings','garage_branches','garage_hours','garage_holidays','garage_field_defs',
                           'garage_checklists','garage_checklist_items','garage_labour_rates','garage_terms',
                           'garage_templates','technician_skills','service_packages','garage_skills'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Public may read what a customer needs to choose and book: branding, hours, holidays, terms, branches.
create policy gset_public_read on garage_settings for select
  using (exists (select 1 from garages g where g.id = garage_id and g.status = 'active') or is_garage_member(garage_id) or is_platform_staff());
create policy gset_owner_write on garage_settings for update using (is_garage_owner(garage_id)) with check (is_garage_owner(garage_id));
create policy gset_admin on garage_settings for all using (is_super_admin()) with check (is_super_admin());

create policy gbranch_public_read on garage_branches for select
  using (active and exists (select 1 from garages g where g.id = garage_id and g.status = 'active') or is_garage_member(garage_id) or is_platform_staff());
create policy gbranch_owner on garage_branches for all using (is_garage_owner(garage_id)) with check (is_garage_owner(garage_id));

create policy ghours_public_read on garage_hours for select
  using (exists (select 1 from garages g where g.id = garage_id and g.status = 'active') or is_garage_member(garage_id));
create policy ghours_owner on garage_hours for all using (is_garage_owner(garage_id)) with check (is_garage_owner(garage_id));

create policy ghol_public_read on garage_holidays for select
  using (exists (select 1 from garages g where g.id = garage_id and g.status = 'active') or is_garage_member(garage_id));
create policy ghol_owner on garage_holidays for all using (is_garage_owner(garage_id)) with check (is_garage_owner(garage_id));

create policy gterms_public_read on garage_terms for select
  using (exists (select 1 from garages g where g.id = garage_id and g.status = 'active') or is_garage_member(garage_id));
create policy gterms_owner on garage_terms for all using (is_garage_owner(garage_id)) with check (is_garage_owner(garage_id));

-- Internal configuration: staff of that garage only.
create policy gfield_member_read on garage_field_defs for select using (is_garage_member(garage_id) or is_platform_staff());
create policy gfield_owner on garage_field_defs for all using (is_garage_owner(garage_id)) with check (is_garage_owner(garage_id));

create policy gchk_member_read on garage_checklists for select using (is_garage_member(garage_id) or is_platform_staff());
create policy gchk_owner on garage_checklists for all using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));

create policy gchki_member_read on garage_checklist_items for select
  using (exists (select 1 from garage_checklists c where c.id = checklist_id and (is_garage_member(c.garage_id) or is_platform_staff())));
create policy gchki_owner on garage_checklist_items for all
  using (exists (select 1 from garage_checklists c where c.id = checklist_id and is_garage_manager(c.garage_id)))
  with check (exists (select 1 from garage_checklists c where c.id = checklist_id and is_garage_manager(c.garage_id)));

-- Rate cards expose cost strategy: managers only, never technicians or the public.
create policy grate_manager on garage_labour_rates for all using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));

create policy gtpl_manager on garage_templates for all using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));

create policy tskill_read on technician_skills for select using (is_garage_member(garage_id) or is_platform_staff());
create policy tskill_owner on technician_skills for all using (is_garage_owner(garage_id)) with check (is_garage_owner(garage_id));

create policy spkg_read on service_packages for select using (true);
create policy spkg_admin on service_packages for all using (is_super_admin()) with check (is_super_admin());
create policy gskill_read on garage_skills for select using (true);
create policy gskill_admin on garage_skills for all using (is_super_admin()) with check (is_super_admin());

create trigger gset_touch before update on garage_settings for each row execute function touch_updated_at();
create trigger gterms_touch before update on garage_terms for each row execute function touch_updated_at();
