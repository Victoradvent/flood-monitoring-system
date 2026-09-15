ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO system_settings (setting_key, setting_value)
VALUES
  ('thresholds', '{"warning_cm": 30, "critical_cm": 50}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;