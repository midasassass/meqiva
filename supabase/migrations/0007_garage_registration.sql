-- Self-service garage registration.
--
-- A signed-in user cannot change their own role (the profiles policy forbids it, and that
-- is deliberate). So registering a garage goes through one security-definer function that
-- does the whole thing atomically and refuses anything it should not do: it creates the
-- garage as `pending`, makes the caller its owner, and promotes their platform role only
-- from `customer`. It can never grant a verification level, approve a listing, or touch an
-- existing garage.

create or replace function register_garage(
  p_public_name text,
  p_phone text default null,
  p_locality text default null,
  p_address text default null,
  p_pincode text default null,
  p_bays int default 1,
  p_gstin text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_role app_role;
  v_slug text;
  v_base text;
  v_n int := 0;
  v_id uuid;
begin
  if v_user is null then raise exception 'Sign in first'; end if;

  select role into v_role from profiles where id = v_user;
  if v_role is null then raise exception 'No profile for this account'; end if;

  -- Platform staff register garages through the admin panel, not through this route.
  if v_role in ('super_admin', 'quality_auditor', 'support_agent') then
    raise exception 'Platform staff cannot register a garage from here';
  end if;

  if exists (select 1 from garage_members where user_id = v_user) then
    raise exception 'This account already belongs to a garage';
  end if;

  if coalesce(trim(p_public_name), '') = '' then raise exception 'Enter the garage name'; end if;
  if length(p_public_name) > 120 then raise exception 'That name is too long'; end if;
  if p_bays is null or p_bays < 1 or p_bays > 100 then raise exception 'Bays must be between 1 and 100'; end if;

  -- A readable, unique slug derived from the name.
  v_base := nullif(regexp_replace(lower(trim(p_public_name)), '[^a-z0-9]+', '-', 'g'), '');
  v_base := trim(both '-' from coalesce(v_base, 'garage'));
  v_base := left(v_base, 48);
  v_slug := v_base;
  while exists (select 1 from garages where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
    if v_n > 500 then raise exception 'Could not generate a unique address for that name'; end if;
  end loop;

  insert into garages (slug, public_name, owner_id, status, verification,
                       phone, locality, address, pincode, bays_count, gstin, city)
  values (v_slug, trim(p_public_name), v_user, 'pending', 'none',
          nullif(trim(coalesce(p_phone, '')), ''), nullif(trim(coalesce(p_locality, '')), ''),
          nullif(trim(coalesce(p_address, '')), ''), nullif(trim(coalesce(p_pincode, '')), ''),
          p_bays, nullif(trim(coalesce(p_gstin, '')), ''), 'Gurugram')
  returning id into v_id;

  insert into garage_members (garage_id, user_id, role) values (v_id, v_user, 'garage_owner');

  -- Only ever an upgrade from the default. Never a downgrade, never to staff.
  if v_role = 'customer' then
    update profiles set role = 'garage_owner' where id = v_user;
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, meta)
  values (v_user, 'garage.registered', 'garage', v_id::text, jsonb_build_object('slug', v_slug));

  return v_id;
end $$;

revoke all on function register_garage(text, text, text, text, text, int, text) from anon;
grant execute on function register_garage(text, text, text, text, text, int, text) to authenticated;

-- How far through setup a new garage is, so the dashboard can point at the next thing.
create or replace function garage_setup_progress(p_garage uuid)
returns table (has_hours boolean, has_pricing boolean, has_services boolean, has_team boolean, pricing_pct int)
language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from garage_hours where garage_id = p_garage and not closed),
    exists (select 1 from garage_price_matrix where garage_id = p_garage and active),
    exists (select 1 from garage_services where garage_id = p_garage and active),
    (select count(*) from garage_members where garage_id = p_garage) > 1,
    coalesce((select pct from garage_pricing_coverage(p_garage)), 0)
$$;
grant execute on function garage_setup_progress(uuid) to authenticated;
