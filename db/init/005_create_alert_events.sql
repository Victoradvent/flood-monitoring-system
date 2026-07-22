CREATE TABLE alert_events (
  id BIGSERIAL PRIMARY KEY,
  alert_id BIGINT REFERENCES alerts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_agent TEXT,
  operator TEXT
);

CREATE INDEX idx_alert_events_alert ON alert_events(alert_id);
