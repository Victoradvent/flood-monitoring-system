ALTER TABLE readings
  ALTER COLUMN water_level_cm DROP NOT NULL;

ALTER TABLE readings
  ADD CONSTRAINT readings_status_values
  CHECK (status IN ('NORMAL', 'WARNING', 'CRITICAL', 'SENSOR_ERROR'));

ALTER TABLE readings
  ADD CONSTRAINT readings_sensor_error_shape
  CHECK ((status = 'SENSOR_ERROR' AND water_level_cm IS NULL)
      OR (status <> 'SENSOR_ERROR' AND water_level_cm IS NOT NULL));

ALTER TABLE readings
  ADD CONSTRAINT readings_water_level_range
  CHECK (water_level_cm IS NULL OR (water_level_cm >= 0 AND water_level_cm <= 1000));

CREATE INDEX IF NOT EXISTS idx_readings_latest
  ON readings(node_id, timestamp DESC, id DESC);