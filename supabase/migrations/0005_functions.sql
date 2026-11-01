-- Server-side business functions. These run with the caller's rights unless noted,
-- so RLS still applies; they exist to make multi-step operations atomic and to put
-- the non-negotiable rules (MRP, approval-before-billing, legal status transitions)
-- behind the database rather than behind a form.

-- ───────── Invoice numbering: atomic per garage ─────────
create or replace function next_invoice_number(p_garage uuid) returns text
language plpgsql security invoker as $$
declare v_prefix text; v_seq int; v_year text;
begin
  update garage_settings set invoice_next_seq = invoice_next_seq + 1
  where garage_id = p_garage
  returning invoice_prefix, invoice_next_seq - 1 into v_prefix, v_seq;
  if v_prefix is null then raise exception 'Garage settings not found'; end if;
  v_year := to_char(now() at time zone 'Asia/Kolkata', 'YY');
  return v_prefix || '/' || v_year || '/' || lpad(v_seq::text, 5, '0');
end $$;

-- ───────── MRP guard, enforced again at the database boundary ─────────
create or replace function assert_quote_mrp(p_lines jsonb) returns void
language plpgsql immutable as $$
declare l jsonb; v_unit bigint; v_mrp bigint; v_qty numeric;
begin
  for l in select * from jsonb_array_elements(p_lines) loop
    if coalesce((l->>'mrp_applies')::boolean, false) then
      v_mrp := nullif(l->>'mrp_paise','')::bigint;
      v_qty := greatest(coalesce(nullif(l->>'qty','')::numeric, 1), 1);
      v_unit := round(coalesce(nullif(l->>'line_total_paise','')::bigint, 0) / v_qty);
      if v_mrp is null then
        raise exception 'MRP is required for packaged item "%"', coalesce(l->>'description','(unnamed)');
      end if;
      if v_unit > v_mrp then
        raise exception 'Price % exceeds declared MRP % for "%"', v_unit, v_mrp, coalesce(l->>'description','(unnamed)');
      end if;
    end if;
  end loop;
end $$;

-- ───────── Publish a quote: immutable customer snapshot, costs stripped ─────────
create or replace function publish_quote(p_quote uuid, p_reason text default null, p_valid_hours int default 72)
returns uuid language plpgsql security invoker as $$
declare q record; v_pub uuid; v_lines jsonb; v_customer uuid;
begin
  select * into q from quotes where id = p_quote for update;
  if q is null then raise exception 'Quote not found'; end if;
  if not is_garage_manager(q.garage_id) then raise exception 'Not permitted'; end if;
  if q.status not in ('draft','issued') then raise exception 'Quote is % and cannot be published', q.status; end if;

  perform assert_quote_mrp(q.lines);

  select coalesce(j.customer_id, b.customer_id) into v_customer
  from quotes qq
  left join job_cards j on j.id = qq.job_card_id
  left join bookings b on b.id = qq.booking_id
  where qq.id = p_quote;

  -- Strip every cost and margin field. The customer sees price only.
  select jsonb_agg(elem - 'unit_cost_paise' - 'line_cost_paise' - 'contribution_paise' - 'margin_bps')
  into v_lines from jsonb_array_elements(q.lines) elem;

  insert into quote_publications (quote_id, garage_id, job_card_id, booking_id, customer_id, version,
    extra_work, reason, lines, subtotal_paise, tax_paise, total_paise, warranty_note, expires_at)
  values (p_quote, q.garage_id, q.job_card_id, q.booking_id, v_customer, q.version,
    q.extra_work, p_reason, coalesce(v_lines, '[]'::jsonb),
    q.subtotal_paise, q.tax_paise, q.customer_total_paise, q.warranty_note,
    now() + make_interval(hours => p_valid_hours))
  returning id into v_pub;

  update quotes set status = 'issued' where id = p_quote;
  return v_pub;
end $$;

-- ───────── Customer decision on a published quote (append-only) ─────────
create or replace function decide_quote(p_publication uuid, p_decision text, p_reason text default null)
returns void language plpgsql security invoker as $$
declare p record;
begin
  if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
  select * into p from quote_publications where id = p_publication;
  if p is null then raise exception 'Quotation not found'; end if;
  if p.customer_id is distinct from auth.uid() then raise exception 'Not permitted'; end if;
  if p.expires_at is not null and p.expires_at < now() then raise exception 'This quotation has expired'; end if;

  insert into customer_approvals (quote_id, publication_id, garage_id, customer_id, quote_version, amount_paise, scope, decision, reason)
  values (p.quote_id, p.id, p.garage_id, auth.uid(), p.version, p.total_paise, p.lines, p_decision, p_reason);

  update quotes set status = case when p_decision = 'approved' then 'approved' else 'rejected' end,
                    reject_reason = case when p_decision = 'rejected' then p_reason else null end
  where id = p.quote_id;
end $$;

-- ───────── Booking status transitions, validated server-side ─────────
create or replace function actor_role_for_booking(p_booking uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare b record; v_role app_role;
begin
  select * into b from bookings where id = p_booking;
  if b is null then return null; end if;
  if is_super_admin() then return 'admin'; end if;
  if auth_role() = 'support_agent' then return 'support'; end if;
  if b.customer_id = auth.uid() then return 'customer'; end if;
  select role into v_role from garage_members where garage_id = b.garage_id and user_id = auth.uid();
  return v_role::text;
end $$;

create or replace function transition_booking(p_booking uuid, p_to booking_status, p_message text default null)
returns booking_status language plpgsql security invoker as $$
declare b record; v_actor text; v_ok boolean := false; v_garage_side boolean; v_shop boolean;
begin
  select * into b from bookings where id = p_booking for update;
  if b is null then raise exception 'Booking not found'; end if;

  v_actor := actor_role_for_booking(p_booking);
  if v_actor is null then raise exception 'Not permitted'; end if;
  v_garage_side := v_actor in ('garage_owner','service_advisor');
  v_shop := v_actor in ('garage_owner','service_advisor','technician');

  v_ok := case b.status
    when 'requested' then (p_to = 'awaiting_garage_confirmation' and v_actor in ('customer','admin'))
                       or (p_to = 'cancelled' and v_actor = 'customer')
    when 'awaiting_garage_confirmation' then (p_to = 'confirmed' and v_garage_side)
                       or (p_to = 'cancelled' and (v_garage_side or v_actor in ('customer','admin')))
    when 'confirmed' then (p_to = 'vehicle_arrived' and v_garage_side)
                       or (p_to = 'cancelled' and (v_garage_side or v_actor in ('customer','admin')))
    when 'vehicle_arrived' then (p_to = 'inspection_in_progress' and v_shop)
                       or (p_to = 'cancelled' and (v_garage_side or v_actor = 'customer'))
    when 'inspection_in_progress' then p_to in ('awaiting_customer_approval','service_in_progress') and v_shop
    when 'awaiting_customer_approval' then (p_to = 'service_in_progress' and (v_actor = 'customer' or v_garage_side))
                       or (p_to = 'awaiting_parts' and v_shop)
                       or (p_to = 'cancelled' and v_actor = 'customer')
    when 'awaiting_parts' then (p_to = 'service_in_progress' and v_shop)
                       or (p_to = 'cancelled' and (v_garage_side or v_actor = 'customer'))
    when 'service_in_progress' then p_to in ('awaiting_customer_approval','awaiting_parts','quality_check') and v_shop
    when 'quality_check' then p_to in ('service_in_progress','ready_for_delivery') and v_garage_side
    when 'ready_for_delivery' then (p_to = 'completed' and v_garage_side)
                       or (p_to = 'disputed' and v_actor in ('customer','support'))
    when 'completed' then p_to = 'disputed' and v_actor in ('customer','support','admin')
    when 'disputed' then p_to in ('completed','cancelled') and v_actor in ('support','admin')
    else false end;

  if not v_ok then
    raise exception 'Transition % -> % is not allowed for %', b.status, p_to, v_actor;
  end if;

  update bookings set status = p_to where id = p_booking;
  insert into booking_events (booking_id, garage_id, from_status, to_status, message, actor_id)
  values (p_booking, b.garage_id, b.status, p_to, p_message, auth.uid());

  if p_to = 'completed' then perform accrue_commission(p_booking); end if;
  return p_to;
end $$;

-- ───────── Commission accrues once, only on completed marketplace jobs ─────────
create or replace function accrue_commission(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b record; r record; v_labour bigint := 0; v_total bigint := 0; v_fee bigint := 0; v_gst_bps int;
begin
  select * into b from bookings where id = p_booking;
  if b is null or b.origin <> 'marketplace' or b.status <> 'completed' then return; end if;
  if exists (select 1 from commission_records where booking_id = p_booking) then return; end if;

  select coalesce(sum(case when (li->>'kind') = 'labour' then (li->>'line_subtotal_paise')::bigint else 0 end), 0),
         coalesce(sum((li->>'line_subtotal_paise')::bigint), 0)
    into v_labour, v_total
  from invoices i, jsonb_array_elements(i.lines) li
  where i.booking_id = p_booking and i.voided_at is null;

  select * into r from commission_rules
   where active and (garage_id = b.garage_id or garage_id is null)
   order by garage_id nulls last limit 1;
  if r is null then return; end if;

  v_fee := case r.type
    when 'fixed' then coalesce(r.amount_paise, 0)
    when 'pct_labour' then round(v_labour * coalesce(r.rate_bps, 0) / 10000.0)
    when 'pct_total' then round(v_total * coalesce(r.rate_bps, 0) / 10000.0) end;

  select coalesce((value->>'commission_gst_bps')::int, 1800) into v_gst_bps from platform_settings where key = 'billing';
  insert into commission_records (garage_id, booking_id, fee_paise, gst_paise)
  values (b.garage_id, p_booking, v_fee, round(v_fee * coalesce(v_gst_bps, 1800) / 10000.0));
end $$;

-- ───────── Consume parts against a job atomically ─────────
-- items: [{ part_id, qty }]
create or replace function consume_parts(p_job uuid, p_items jsonb) returns void
language plpgsql security invoker as $$
declare it jsonb; v_garage uuid;
begin
  select garage_id into v_garage from job_cards where id = p_job;
  if v_garage is null then raise exception 'Job card not found'; end if;
  if not is_garage_member(v_garage) then raise exception 'Not permitted'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    perform apply_stock_movement((it->>'part_id')::uuid, 'job_consume', (it->>'qty')::int, p_job, 'Consumed on job');
  end loop;
end $$;

create or replace function return_parts(p_job uuid, p_items jsonb) returns void
language plpgsql security invoker as $$
declare it jsonb; v_garage uuid;
begin
  select garage_id into v_garage from job_cards where id = p_job;
  if v_garage is null then raise exception 'Job card not found'; end if;
  if not is_garage_manager(v_garage) then raise exception 'Not permitted'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    perform apply_stock_movement((it->>'part_id')::uuid, 'job_return', (it->>'qty')::int, p_job, 'Returned to stock');
  end loop;
end $$;

-- ───────── Issue an invoice: refuses unapproved extra work ─────────
create or replace function issue_invoice(p_job uuid, p_lines jsonb, p_subtotal bigint, p_tax bigint, p_total bigint)
returns uuid language plpgsql security invoker as $$
declare j record; s record; v_no text; v_id uuid; v_unapproved int; v_intra boolean;
begin
  select * into j from job_cards where id = p_job;
  if j is null then raise exception 'Job card not found'; end if;
  if not is_garage_manager(j.garage_id) then raise exception 'Not permitted'; end if;

  perform assert_quote_mrp(p_lines);

  -- Every extra-work publication on this job must carry an approval of at least its amount.
  select count(*) into v_unapproved
  from quote_publications qp
  where qp.job_card_id = p_job and qp.extra_work
    and not exists (select 1 from customer_approvals ca
                    where ca.publication_id = qp.id and ca.decision = 'approved' and ca.amount_paise >= qp.total_paise);
  if v_unapproved > 0 then
    raise exception 'Cannot invoice: % extra-work item(s) have no customer approval', v_unapproved;
  end if;

  select * into s from garage_settings where garage_id = j.garage_id;
  v_no := next_invoice_number(j.garage_id);
  v_intra := true; -- place of supply equals garage state in Phase 1; cross-state billing needs review

  insert into invoices (garage_id, job_card_id, booking_id, customer_id, number, lines,
    subtotal_paise, tax_paise, total_paise,
    cgst_paise, sgst_paise, igst_paise, place_of_supply, gstin)
  values (j.garage_id, p_job, j.booking_id, j.customer_id, v_no, p_lines,
    p_subtotal, p_tax, p_total,
    case when v_intra then p_tax / 2 else 0 end,
    case when v_intra then p_tax - (p_tax / 2) else 0 end,
    case when v_intra then 0 else p_tax end,
    s.place_of_supply_code, (select gstin from garages where id = j.garage_id))
  returning id into v_id;

  update job_cards set completed_at = coalesce(completed_at, now()) where id = p_job;
  return v_id;
end $$;

-- ───────── Busy intervals for slot computation ─────────
create or replace function garage_busy(p_garage uuid, p_from timestamptz, p_to timestamptz)
returns table (slot_start timestamptz, slot_end timestamptz, bay_id uuid)
language sql stable security definer set search_path = public as $$
  select b.slot_start, b.slot_end, b.bay_id
  from bookings b
  where b.garage_id = p_garage
    and b.status not in ('cancelled','completed')
    and b.slot_start is not null and b.slot_end is not null
    and b.slot_start < p_to and b.slot_end > p_from
$$;

-- ───────── Public, rate-safe garage counters for the marketing site ─────────
create or replace function platform_counters()
returns table (active_garages bigint, verified_garages bigint, completed_services bigint, localities bigint)
language sql stable security definer set search_path = public as $$
  select (select count(*) from garages where status = 'active'),
         (select count(*) from garages where verification in ('verified','quality_assured') and status = 'active'),
         (select count(*) from bookings where status = 'completed'),
         (select count(distinct locality) from garages where status = 'active' and locality is not null)
$$;
grant execute on function platform_counters() to anon, authenticated;
