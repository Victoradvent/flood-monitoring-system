-- Alert recipients table for tracking delivery status per recipient
CREATE TABLE IF NOT EXISTS alert_recipients (
  id BIGSERIAL PRIMARY KEY,
  alert_id BIGINT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  subscriber_id BIGINT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'PENDING', -- PENDING, SENT, FAILED, DELIVERED
  delivery_provider TEXT, -- 'sms', 'websocket', 'email'
  provider_response JSONB,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_alert_recipients_alert ON alert_recipients(alert_id);
CREATE INDEX idx_alert_recipients_subscriber ON alert_recipients(subscriber_id);
CREATE INDEX idx_alert_recipients_status ON alert_recipients(status);
