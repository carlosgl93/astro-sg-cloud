alter table tenant_whatsapp_credentials
  add column if not exists token_expires_at timestamptz;
