-- Allow tenant admins/owners to insert WhatsApp credentials
create policy "Tenant admins insert credentials"
  on tenant_whatsapp_credentials for insert
  with check (tenant_id in (
    select tenant_id from tenant_users
    where user_id = auth.uid() and role in ('owner', 'admin')
  ));

-- Allow tenant admins/owners to update WhatsApp credentials
create policy "Tenant admins update credentials"
  on tenant_whatsapp_credentials for update
  using (tenant_id in (
    select tenant_id from tenant_users
    where user_id = auth.uid() and role in ('owner', 'admin')
  ));
