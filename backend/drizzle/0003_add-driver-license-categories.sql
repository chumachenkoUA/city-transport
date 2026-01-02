ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS license_categories jsonb NOT NULL DEFAULT '[]'::jsonb;
