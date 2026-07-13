CREATE TABLE IF NOT EXISTS platform_settings (
  id integer PRIMARY KEY DEFAULT 1,
  is_streaming_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE platform_settings DROP CONSTRAINT IF EXISTS platform_settings_single_row;
ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_single_row CHECK (id = 1);

INSERT INTO platform_settings (id, is_streaming_enabled) VALUES (1, false) ON CONFLICT (id) DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read platform_settings" ON platform_settings;
CREATE POLICY "Anyone can read platform_settings" ON platform_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update platform_settings" ON platform_settings;
CREATE POLICY "Admins can update platform_settings" ON platform_settings FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
