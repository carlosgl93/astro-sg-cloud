-- Function to create a tenant and associate the calling user as owner.
-- Called via supabase.rpc('create_tenant_for_user', { p_name, p_slug })
-- from the signup form after auth.signUp() succeeds.

create or replace function create_tenant_for_user(
  p_name text,
  p_slug text
) returns uuid
language plpgsql
security definer  -- runs with table owner privileges to bypass RLS
as $$
declare
  v_tenant_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Create the tenant
  insert into tenants (name, slug)
  values (p_name, p_slug)
  returning id into v_tenant_id;

  -- Associate the user as owner
  insert into tenant_users (user_id, tenant_id, role)
  values (v_user_id, v_tenant_id, 'owner');

  return v_tenant_id;
end;
$$;
