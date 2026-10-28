-- Synthetic grid equipment and locations for disposable development/test databases only.
INSERT INTO grid_equipment (equipment_code, name, location, status, recommended, description, risk_zone, historical_readings)
SELECT seed.equipment_code, seed.name,
       ST_SetSRID(ST_MakePoint(n.lng + offset_lng, n.lat + offset_lat), 4326)::geography,
      seed.status, FALSE, seed.description, seed.risk_zone, seed.historical_readings
FROM (VALUES
  ('TX-AN-001', 'NODE001', 'Simulated Awka North Transformer', 'NORMAL', 'LOW', 0.004, 0.003, 'SIMULATED location; no field asset is represented', '[{"date":"2026-09-10","water_level_cm":18},{"date":"2026-09-12","water_level_cm":22}]'::jsonb),
  ('TX-AN-002', 'NODE002', 'Simulated Ifite Feeder Transformer', 'NORMAL', 'MEDIUM', -0.003, -0.004, 'SIMULATED location; no field asset is represented', '[{"date":"2026-09-10","water_level_cm":27},{"date":"2026-09-12","water_level_cm":31}]'::jsonb),
  ('TX-AN-003', 'NODE003', 'Simulated Amawbia Substation Transformer', 'NORMAL', 'HIGH', 0.002, -0.003, 'SIMULATED location; no field asset is represented', '[{"date":"2026-09-10","water_level_cm":34},{"date":"2026-09-12","water_level_cm":39}]'::jsonb),
  ('TX-AN-004', 'NODE004', 'Simulated Nibo Distribution Transformer', 'INSPECTION_REQUIRED', 'HIGH', -0.004, 0.002, 'SIMULATED location; no field asset is represented', '[{"date":"2026-09-10","water_level_cm":42},{"date":"2026-09-12","water_level_cm":48}]'::jsonb),
  ('TX-AN-005', 'NODE005', 'Simulated Awka South Transformer', 'NORMAL', 'MEDIUM', 0.003, 0.004, 'SIMULATED location; no field asset is represented', '[{"date":"2026-09-10","water_level_cm":20},{"date":"2026-09-12","water_level_cm":25}]'::jsonb),
  ('TX-AN-006', 'NODE006', 'Simulated Okpuno Feeder Transformer', 'CLEARED', 'LOW', -0.002, 0.003, 'SIMULATED location; no field asset is represented', '[{"date":"2026-09-10","water_level_cm":15},{"date":"2026-09-12","water_level_cm":19}]'::jsonb)
) AS seed(equipment_code, node_id, name, status, risk_zone, offset_lat, offset_lng, description, historical_readings)
JOIN nodes n ON n.node_id = seed.node_id
ON CONFLICT (equipment_code) DO UPDATE SET
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  status = EXCLUDED.status,
  description = EXCLUDED.description,
  risk_zone = EXCLUDED.risk_zone,
  historical_readings = EXCLUDED.historical_readings;
