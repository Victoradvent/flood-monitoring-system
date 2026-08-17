CREATE TABLE IF NOT EXISTS readings (
  id BIGSERIAL PRIMARY KEY,
  node_id TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  water_level_cm REAL NOT NULL,
  battery_v REAL,
  status TEXT NOT NULL,
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_readings_node_time ON readings(node_id, timestamp DESC);
CREATE INDEX idx_readings_status ON readings(status);
