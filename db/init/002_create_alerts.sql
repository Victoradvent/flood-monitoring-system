CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  node_id TEXT NOT NULL,
  alert_level TEXT NOT NULL, -- OK, WARNING, CRITICAL
  water_level_cm REAL,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sent BOOLEAN DEFAULT FALSE,
  provider TEXT, -- 'sms', 'websocket', 'email'
  provider_response JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_alerts_node_level ON alerts(node_id, alert_level);
CREATE INDEX idx_alerts_triggered ON alerts(triggered_at DESC);
CREATE INDEX idx_alerts_sent ON alerts(sent);
CREATE INDEX idx_alerts_acknowledged ON alerts(acknowledged);
