CREATE TABLE tenant_bot_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  system_prompt   TEXT,
  greeting        TEXT,
  handoff_trigger TEXT,
  business_hours  JSONB DEFAULT '{"enabled": false, "timezone": "America/Santiago", "schedule": {}}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON tenant_bot_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE tenant_bot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_can_read_config"
  ON tenant_bot_config FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "tenant_admins_can_write_config"
  ON tenant_bot_config FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
