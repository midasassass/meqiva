-- Operational tables: published quotes, evidence, procurement, CRM, fleet, CMS, compliance.

-- ───────── Customer-facing quote snapshot ─────────
-- `quotes` keeps costs and margin and is manager-only. Publishing writes an immutable
-- snapshot with no cost data, which is what the customer reads and approves against.
create table quote_publications (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  garage_id uuid not null references garages(id) on delete cascade,
  job_card_id uuid references job_cards(id) on delete cascade,
  booking_id uuid references bookings(id),
  customer_id uuid references profiles(id),
  version int not null,
  extra_work boolean not null default false,
  reason text,
  -- [{ description, kind, qty, unit_price_paise, line_total_paise, gst_bps, mrp_paise }]
  lines jsonb not null,
  subtotal_paise bigint not null,
  tax_paise bigint not null,
  total_paise bigint not null,
  warranty_note text,
  expires_at timestamptz,
  published_at timestamptz not null default now(),
  unique (quote_id, version)
);
create index on quote_publications (customer_id, published_at desc);
create index on quote_publications (job_card_id);

create trigger qpub_append_only before update or delete on quote_publications for each row execute function forbid_mutation();

alter table customer_approvals add column publication_id uuid references quote_publications(id);
alter table customer_approvals add column reason text;

-- Totals are computed once by the tested quote engine and stored, so publishing is a pure copy.
alter table quotes add column subtotal_paise bigint not null default 0;
alter table quotes add column tax_paise bigint not null default 0;
alter table quotes add column marketplace_fee_paise bigint not null default 0;
alter table quotes add column warranty_note text;
alter table quotes add column created_by uuid references profiles(id);

-- ───────── Checklists performed on a job ─────────
create table checklist_runs (
  id uuid primary key default gen_random_uuid(),
  job_card_id uuid not null references job_cards(id) on delete cascade,
  garage_id uuid not null references garages(id) on delete cascade,
  checklist_id uuid references garage_checklists(id),
  name text not null,
  completed_at timestamptz,
  completed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table checklist_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references checklist_runs(id) on delete cascade,
  item_id uuid references garage_checklist_items(id),
  label text not null,
  status text not null default 'pending' check (status in ('pending','ok','attention','fail','na')),
  note text,
  media_path text,
  sort int not null default 0
);
create index on checklist_results (run_id, sort);

-- ───────── Service evidence (private storage paths, never public URLs) ─────────
create table service_evidence (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  job_card_id uuid references job_cards(id) on delete cascade,
  booking_id uuid references bookings(id),
  kind text not null default 'photo' check (kind in ('photo','video','document')),
  storage_path text not null,
  caption text,
  stage text,
  visible_to_customer boolean not null default true,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on service_evidence (job_card_id, created_at);

-- ───────── Vehicle passport: customer-uploaded history is kept separate from verified ─────────
create table vehicle_service_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  source text not null default 'customer_upload' check (source in ('customer_upload','external_garage')),
  serviced_on date not null,
  odometer_km int,
  garage_name text,
  summary text,
  amount_paise bigint,
  document_path text,
  created_at timestamptz not null default now()
);
create index on vehicle_service_records (vehicle_id, serviced_on desc);

-- ───────── Procurement ─────────
create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  supplier_id uuid references suppliers(id),
  number text not null,
  status text not null default 'draft' check (status in ('draft','sent','partially_received','received','cancelled')),
  expected_on date,
  note text,
  total_paise bigint not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (garage_id, number)
);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  part_id uuid references parts(id),
  description text not null,
  qty int not null check (qty > 0),
  received_qty int not null default 0 check (received_qty >= 0),
  unit_cost_paise bigint not null check (unit_cost_paise >= 0),
  check (received_qty <= qty)
);

-- ───────── CRM ─────────
create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  customer_id uuid references profiles(id),
  vehicle_id uuid references vehicles(id),
  quote_id uuid references quotes(id),
  kind text not null default 'quote_recovery' check (kind in ('quote_recovery','service_due','complaint','callback','other')),
  due_on date not null default current_date,
  note text,
  outcome text check (outcome in ('won','lost','no_response','rescheduled')),
  lost_reason text,
  closed_at timestamptz,
  assigned_to uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on follow_ups (garage_id, due_on) where closed_at is null;

create table service_reminders (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  customer_id uuid references profiles(id),
  due_on date not null,
  reason text not null,
  sent_at timestamptz,
  channel text,
  dismissed boolean not null default false,
  unique (garage_id, vehicle_id, due_on)
);

-- ───────── Fleet ─────────
create table fleet_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gstin text,
  billing_email text,
  manager_id uuid references profiles(id),
  preferred_garage_id uuid references garages(id),
  created_at timestamptz not null default now()
);
create table fleet_members (
  fleet_id uuid not null references fleet_accounts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  can_approve boolean not null default false,
  primary key (fleet_id, user_id)
);
create table fleet_vehicles (
  fleet_id uuid not null references fleet_accounts(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  primary key (fleet_id, vehicle_id)
);

-- ───────── Payments: settlements and compliance ─────────
create table settlements (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id),
  period_start date not null, period_end date not null,
  gross_paise bigint not null default 0,
  commission_paise bigint not null default 0,
  refunds_paise bigint not null default 0,
  net_paise bigint not null default 0,
  status text not null default 'pending' check (status in ('pending','processing','paid','failed')),
  provider_ref text, note text,
  created_at timestamptz not null default now()
);

alter table invoices add column cgst_paise bigint not null default 0;
alter table invoices add column sgst_paise bigint not null default 0;
alter table invoices add column igst_paise bigint not null default 0;
alter table invoices add column place_of_supply text;
alter table invoices add column gstin text;
alter table invoices add column customer_id uuid references profiles(id);
alter table invoices add column voided_at timestamptz;

-- Every blocked or attempted over-MRP price is logged for the admin compliance queue.
create table pricing_violations (
  id bigint generated always as identity primary key,
  garage_id uuid not null references garages(id) on delete cascade,
  actor_id uuid references profiles(id),
  part_id uuid references parts(id),
  context text not null default 'quote',
  description text,
  attempted_paise bigint,
  mrp_paise bigint,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index on pricing_violations (garage_id, created_at desc) where resolved_at is null;

-- ───────── Support conversation ─────────
create table ticket_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_id uuid references profiles(id),
  body text not null,
  internal boolean not null default false,
  media_path text,
  created_at timestamptz not null default now()
);
create index on ticket_messages (ticket_id, created_at);

-- ───────── Notification outbox with retries ─────────
create table notification_outbox (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade,
  garage_id uuid references garages(id) on delete cascade,
  channel text not null check (channel in ('in_app','email','sms','whatsapp')),
  event text not null,
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  attempts int not null default 0,
  last_error text,
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notification_outbox (status, send_after) where status = 'queued';

-- ───────── Staff invitations ─────────
create table staff_invites (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id) on delete cascade,
  email text not null,
  role app_role not null check (role in ('service_advisor','technician','garage_owner')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references profiles(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  unique (garage_id, email)
);

-- ───────── Content management ─────────
create table cms_pages (
  slug text primary key,
  title text not null,
  body text not null,
  meta_description text,
  published boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

create table faqs (
  id serial primary key,
  topic text not null default 'general',
  question text not null,
  answer text not null,
  audience text not null default 'customer' check (audience in ('customer','garage')),
  sort int not null default 0,
  published boolean not null default true
);

create table seo_localities (
  slug text primary key,
  city text not null default 'Gurugram',
  name text not null,
  intro text,
  published boolean not null default true
);

create table platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

-- ───────── RLS ─────────
do $$ declare t text; begin
  foreach t in array array['quote_publications','checklist_runs','checklist_results','service_evidence',
    'vehicle_service_records','purchase_orders','purchase_order_items','follow_ups','service_reminders',
    'fleet_accounts','fleet_members','fleet_vehicles','settlements','pricing_violations','ticket_messages',
    'notification_outbox','staff_invites','cms_pages','faqs','seo_localities','platform_settings'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

create policy qpub_read on quote_publications for select
  using (customer_id = auth.uid() or is_garage_manager(garage_id) or is_platform_staff());
create policy qpub_write on quote_publications for insert with check (is_garage_manager(garage_id));

create policy crun_read on checklist_runs for select using (
  is_garage_member(garage_id) or is_platform_staff()
  or exists (select 1 from job_cards j where j.id = job_card_id and j.customer_id = auth.uid()));
create policy crun_write on checklist_runs for all using (is_garage_member(garage_id)) with check (is_garage_member(garage_id));

create policy cres_read on checklist_results for select
  using (exists (select 1 from checklist_runs r where r.id = run_id and (is_garage_member(r.garage_id) or is_platform_staff()
         or exists (select 1 from job_cards j where j.id = r.job_card_id and j.customer_id = auth.uid()))));
create policy cres_write on checklist_results for all
  using (exists (select 1 from checklist_runs r where r.id = run_id and is_garage_member(r.garage_id)))
  with check (exists (select 1 from checklist_runs r where r.id = run_id and is_garage_member(r.garage_id)));

create policy sev_read on service_evidence for select using (
  is_garage_member(garage_id) or is_platform_staff()
  or (visible_to_customer and exists (select 1 from job_cards j where j.id = job_card_id and j.customer_id = auth.uid())));
create policy sev_write on service_evidence for insert with check (is_garage_member(garage_id));
create policy sev_manage on service_evidence for update using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));

create policy vsr_owner on vehicle_service_records for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy vsr_garage_read on vehicle_service_records for select
  using (exists (select 1 from job_cards j where j.vehicle_id = vehicle_service_records.vehicle_id and is_garage_member(j.garage_id)));

create policy po_manager on purchase_orders for all using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));
create policy poi_manager on purchase_order_items for all
  using (exists (select 1 from purchase_orders p where p.id = po_id and is_garage_manager(p.garage_id)))
  with check (exists (select 1 from purchase_orders p where p.id = po_id and is_garage_manager(p.garage_id)));

create policy fu_manager on follow_ups for all using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));
create policy rem_manager on service_reminders for all using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));
create policy rem_customer_read on service_reminders for select using (customer_id = auth.uid());

create policy fleet_member_read on fleet_accounts for select
  using (manager_id = auth.uid() or exists (select 1 from fleet_members m where m.fleet_id = id and m.user_id = auth.uid()) or is_platform_staff());
create policy fleet_manager_write on fleet_accounts for all using (manager_id = auth.uid()) with check (manager_id = auth.uid());
create policy fmem_read on fleet_members for select using (user_id = auth.uid() or exists (select 1 from fleet_accounts f where f.id = fleet_id and f.manager_id = auth.uid()));
create policy fmem_write on fleet_members for all
  using (exists (select 1 from fleet_accounts f where f.id = fleet_id and f.manager_id = auth.uid()))
  with check (exists (select 1 from fleet_accounts f where f.id = fleet_id and f.manager_id = auth.uid()));
create policy fveh_read on fleet_vehicles for select
  using (exists (select 1 from fleet_members m where m.fleet_id = fleet_id and m.user_id = auth.uid())
         or exists (select 1 from fleet_accounts f where f.id = fleet_id and f.manager_id = auth.uid()));
create policy fveh_write on fleet_vehicles for all
  using (exists (select 1 from fleet_accounts f where f.id = fleet_id and f.manager_id = auth.uid()))
  with check (exists (select 1 from fleet_accounts f where f.id = fleet_id and f.manager_id = auth.uid()));

create policy settle_read on settlements for select using (is_garage_owner(garage_id) or is_super_admin());
create policy settle_admin on settlements for all using (is_super_admin()) with check (is_super_admin());

create policy pv_read on pricing_violations for select using (is_garage_owner(garage_id) or is_platform_staff());
create policy pv_insert on pricing_violations for insert with check (is_garage_member(garage_id));
create policy pv_admin on pricing_violations for update using (is_super_admin()) with check (is_super_admin());

create policy tmsg_read on ticket_messages for select using (
  not internal and exists (select 1 from support_tickets t where t.id = ticket_id and (t.customer_id = auth.uid() or is_garage_manager(t.garage_id)))
  or is_platform_staff());
create policy tmsg_write on ticket_messages for insert with check (
  author_id = auth.uid() and exists (select 1 from support_tickets t where t.id = ticket_id
    and (t.customer_id = auth.uid() or is_garage_manager(t.garage_id) or is_platform_staff())));

-- Outbox is written by the server (service role) and read by staff for delivery tracking.
create policy outbox_staff_read on notification_outbox for select using (is_platform_staff() or is_garage_manager(garage_id));

create policy invite_owner on staff_invites for all using (is_garage_owner(garage_id)) with check (is_garage_owner(garage_id));
create policy invite_admin_read on staff_invites for select using (is_platform_staff());

create policy cms_public_read on cms_pages for select using (published or is_platform_staff());
create policy cms_admin on cms_pages for all using (is_super_admin()) with check (is_super_admin());
create policy faq_public_read on faqs for select using (published or is_platform_staff());
create policy faq_admin on faqs for all using (is_super_admin()) with check (is_super_admin());
create policy seo_public_read on seo_localities for select using (published or is_platform_staff());
create policy seo_admin on seo_localities for all using (is_super_admin()) with check (is_super_admin());
create policy psettings_read on platform_settings for select using (is_platform_staff());
create policy psettings_admin on platform_settings for all using (is_super_admin()) with check (is_super_admin());

create trigger cms_touch before update on cms_pages for each row execute function touch_updated_at();
create trigger psettings_touch before update on platform_settings for each row execute function touch_updated_at();
