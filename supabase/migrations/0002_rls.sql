-- Row Level Security: tenant isolation enforced in the database, not the UI.

create or replace function auth_role() returns app_role language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create or replace function is_platform_staff() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(auth_role() in ('super_admin','quality_auditor','support_agent'), false) $$;

create or replace function is_super_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(auth_role() = 'super_admin', false) $$;

create or replace function is_garage_member(g uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from garage_members where garage_id = g and user_id = auth.uid()) $$;

create or replace function garage_member_role(g uuid) returns app_role language sql stable security definer set search_path = public as
$$ select role from garage_members where garage_id = g and user_id = auth.uid() $$;

-- Owner or advisor (not technician): can see money, pricing and customers.
create or replace function is_garage_manager(g uuid) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(garage_member_role(g) in ('garage_owner','service_advisor'), false) $$;

create or replace function is_garage_owner(g uuid) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(garage_member_role(g) = 'garage_owner', false) $$;

-- Enable RLS everywhere.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Prevent privilege escalation: a user can never change their own role.
create policy profiles_self_read on profiles for select using (id = auth.uid() or is_platform_staff());
create policy profiles_self_update on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
-- Garage staff can see names of colleagues and of customers on their bookings.
create policy profiles_garage_read on profiles for select using (
  exists (select 1 from garage_members me join garage_members peer on peer.garage_id = me.garage_id
          where me.user_id = auth.uid() and peer.user_id = profiles.id)
  or exists (select 1 from bookings b where b.customer_id = profiles.id and is_garage_member(b.garage_id))
);
create policy profiles_admin_write on profiles for all using (is_super_admin()) with check (is_super_admin());

-- Public catalogues (read-only to everyone, write by super admin).
do $$ declare t text; begin
  foreach t in array array['vehicle_makes','vehicle_models','vehicle_variants','service_categories','subscription_plans','feature_flags'] loop
    execute format('create policy %I_read on %I for select using (true)', t, t);
    execute format('create policy %I_admin on %I for all using (is_super_admin()) with check (is_super_admin())', t, t);
  end loop;
end $$;

-- Garages: active ones are publicly listable; members manage their own; staff see all.
create policy garages_public_read on garages for select using (status = 'active' or is_garage_member(id) or is_platform_staff());
create policy garages_owner_update on garages for update using (is_garage_owner(id)) with check (is_garage_owner(id) and status = (select status from garages g where g.id = garages.id) and verification = (select verification from garages g where g.id = garages.id));
create policy garages_signup on garages for insert with check (owner_id = auth.uid() and status = 'pending' and verification = 'none');
create policy garages_admin on garages for all using (is_super_admin()) with check (is_super_admin());

create policy members_read on garage_members for select using (user_id = auth.uid() or is_garage_manager(garage_id) or is_platform_staff());
create policy members_owner_write on garage_members for all using (is_garage_owner(garage_id)) with check (is_garage_owner(garage_id));

-- Customer vehicles: owner only. Garages see only vehicles tied to their bookings/jobs.
create policy vehicles_owner on vehicles for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy vehicles_garage_read on vehicles for select using (
  exists (select 1 from bookings b where b.vehicle_id = vehicles.id and is_garage_member(b.garage_id))
  or exists (select 1 from job_cards j where j.vehicle_id = vehicles.id and is_garage_member(j.garage_id)));

-- Garage service pricing is public for active garages (transparent comparison); only managers edit.
create policy gs_public_read on garage_services for select using (
  active and exists (select 1 from garages g where g.id = garage_id and g.status = 'active') or is_garage_member(garage_id) or is_platform_staff());
create policy gs_manager_write on garage_services for all using (is_garage_owner(garage_id)) with check (is_garage_owner(garage_id));

-- Parts, suppliers, stock: managers only (technicians do NOT see purchase costs).
create policy parts_manager on parts for all using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));
create policy suppliers_manager on suppliers for all using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));
create policy stock_manager_read on stock_movements for select using (is_garage_manager(garage_id));
create policy stock_manager_insert on stock_movements for insert with check (is_garage_manager(garage_id));

create policy bays_member_read on service_bays for select using (is_garage_member(garage_id) or is_platform_staff());
create policy bays_manager_write on service_bays for all using (is_garage_owner(garage_id)) with check (is_garage_owner(garage_id));

-- Bookings
create policy bookings_customer_read on bookings for select using (customer_id = auth.uid());
create policy bookings_customer_insert on bookings for insert with check (customer_id = auth.uid() and origin = 'marketplace' and status in ('requested','awaiting_garage_confirmation'));
create policy bookings_garage_read on bookings for select using (is_garage_member(garage_id));
create policy bookings_manager_write on bookings for insert with check (is_garage_manager(garage_id));
create policy bookings_manager_update on bookings for update using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));
create policy bookings_admin_read on bookings for select using (is_platform_staff());

create policy bevents_read on booking_events for select using (
  is_garage_member(garage_id) or is_platform_staff() or exists (select 1 from bookings b where b.id = booking_id and b.customer_id = auth.uid()));
create policy bevents_insert on booking_events for insert with check (is_garage_member(garage_id) or exists (select 1 from bookings b where b.id = booking_id and b.customer_id = auth.uid()));

-- Job cards: technicians see only jobs assigned to them; managers see all of their garage.
create policy jobs_manager on job_cards for all using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));
create policy jobs_tech_read on job_cards for select using (technician_id = auth.uid() and is_garage_member(garage_id));
create policy jobs_tech_update on job_cards for update using (technician_id = auth.uid() and is_garage_member(garage_id)) with check (technician_id = auth.uid());
create policy jobs_customer_read on job_cards for select using (customer_id = auth.uid());

-- Quotes contain costs/contribution => managers only. Customers read via the secure view below.
create policy quotes_manager on quotes for all using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));
create policy quotes_admin_read on quotes for select using (is_super_admin());

-- Customers never read `quotes` directly, in any form. That table holds unit costs and
-- contribution margin. What a customer reads is `quote_publications` (migration 0004):
-- an immutable snapshot written by publish_quote() with every cost field stripped out.

-- Approvals: only the customer on the job can insert; nobody can update/delete (trigger).
create policy approvals_customer_insert on customer_approvals for insert with check (customer_id = auth.uid());
create policy approvals_read on customer_approvals for select using (customer_id = auth.uid() or is_garage_manager(garage_id) or is_platform_staff());

-- Invoices & payments
create policy invoices_manager on invoices for select using (is_garage_manager(garage_id) or is_platform_staff());
create policy invoices_customer on invoices for select using (exists (select 1 from bookings b where b.id = booking_id and b.customer_id = auth.uid()));
create policy invoices_manager_write on invoices for insert with check (is_garage_manager(garage_id));
create policy payments_read on payments for select using (customer_id = auth.uid() or is_garage_manager(garage_id) or is_platform_staff());
-- Payment rows and webhooks are written ONLY by the server using the service role (bypasses RLS).
create policy refunds_read on refunds for select using (exists (select 1 from payments p where p.id = payment_id and (p.customer_id = auth.uid() or is_garage_manager(p.garage_id))) or is_platform_staff());
create policy commission_read on commission_records for select using (is_garage_owner(garage_id) or is_super_admin());
create policy commrules_read on commission_rules for select using (garage_id is null or is_garage_owner(garage_id) or is_super_admin());
create policy commrules_admin on commission_rules for all using (is_super_admin()) with check (is_super_admin());
create policy subs_read on subscriptions for select using (is_garage_owner(garage_id) or is_super_admin());
create policy subs_admin on subscriptions for all using (is_super_admin()) with check (is_super_admin());

-- Reviews: public read; only the booking's customer may write, and only after completion.
create policy reviews_public_read on reviews for select using (true);
create policy reviews_customer_insert on reviews for insert with check (
  customer_id = auth.uid() and exists (select 1 from bookings b where b.id = booking_id and b.customer_id = auth.uid() and b.status = 'completed'));
create policy reviews_garage_reply on reviews for update using (is_garage_owner(garage_id)) with check (is_garage_owner(garage_id));

create policy audits_staff on garage_audits for all using (auth_role() in ('super_admin','quality_auditor')) with check (auth_role() in ('super_admin','quality_auditor'));
create policy audits_garage_read on garage_audits for select using (is_garage_owner(garage_id));

create policy tickets_party_read on support_tickets for select using (customer_id = auth.uid() or is_garage_manager(garage_id) or is_platform_staff());
create policy tickets_customer_insert on support_tickets for insert with check (customer_id = auth.uid());
create policy tickets_staff_update on support_tickets for update using (auth_role() in ('super_admin','support_agent')) with check (true);

create policy notif_own on notifications for select using (user_id = auth.uid());
create policy notif_own_update on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy camera_read on camera_sessions for select using (
  is_garage_manager(garage_id) or is_super_admin()
  or (expires_at > now() and ended_at is null and exists (select 1 from bookings b where b.id = booking_id and b.customer_id = auth.uid())));
create policy camera_manager_write on camera_sessions for all using (is_garage_manager(garage_id)) with check (is_garage_manager(garage_id));

create policy audit_super_read on audit_logs for select using (is_super_admin());
create policy audit_insert on audit_logs for insert with check (actor_id = auth.uid());

-- webhook_events: no policies => inaccessible to clients; service role only.
