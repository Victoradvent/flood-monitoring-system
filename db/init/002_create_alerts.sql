CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  node_id INTEGER NOT NULL,
  severity VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
