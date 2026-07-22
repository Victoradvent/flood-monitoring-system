-- readings table: stores raw sensor readings
CREATE TABLE readings (
  id BIGSERIAL PRIMARY KEY,
  node_id TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  water_level_cm REAL NOT NULL,
  battery_v REAL,
  status TEXT NOT NULL,
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- alerts table: records alerts sent
CREATE TABLE alerts (
  id BIGSERIAL PRIMARY KEY,
  node_id TEXT NOT NULL,
  alert_level TEXT NOT NULL, -- WARNING or CRITICAL
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sent BOOLEAN DEFAULT FALSE,
  provider TEXT,
  provider_response JSONB
);

-- index for fast node queries
CREATE INDEX idx_readings_node_time ON readings(node_id, timestamp DESC);
