CREATE TABLE IF NOT EXISTS operational_zones (
  zone_code TEXT PRIMARY KEY
    CHECK (zone_code ~ '^[A-Z0-9][A-Z0-9_-]{0,63}$'),
  display_name TEXT NOT NULL CHECK (BTRIM(display_name) <> ''),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS scope_zone TEXT;

ALTER TABLE grid_equipment
  ADD COLUMN IF NOT EXISTS scope_zone TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nodes_scope_zone_fk'
  ) THEN
    ALTER TABLE nodes
      ADD CONSTRAINT nodes_scope_zone_fk
      FOREIGN KEY (scope_zone) REFERENCES operational_zones(zone_code)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'grid_equipment_scope_zone_fk'
  ) THEN
    ALTER TABLE grid_equipment
      ADD CONSTRAINT grid_equipment_scope_zone_fk
      FOREIGN KEY (scope_zone) REFERENCES operational_zones(zone_code)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_assigned_zone_fk'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_assigned_zone_fk
      FOREIGN KEY (assigned_zone) REFERENCES operational_zones(zone_code)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_assigned_zone
  ON users(assigned_zone) WHERE assigned_zone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nodes_scope_zone
  ON nodes(scope_zone) WHERE scope_zone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_grid_equipment_scope_zone
  ON grid_equipment(scope_zone) WHERE scope_zone IS NOT NULL;
