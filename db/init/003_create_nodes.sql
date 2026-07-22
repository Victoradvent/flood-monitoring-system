CREATE TABLE nodes (
  id BIGSERIAL PRIMARY KEY,
  node_id TEXT UNIQUE NOT NULL,
  name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Example inserts
INSERT INTO nodes (node_id, name, lat, lng, description)
VALUES
  ('NODE001', 'Transformer near Awka North', 6.2100, 7.0700, 'Critical transformer prone to flooding'),
  ('NODE002', 'Feeder pillar at Ifite', 6.2200, 7.0800, 'Feeder pillar near Ifite market');
