-- Audit logs table - renamed from 007 to 009 to avoid numbering conflict
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- FLOOD_DETECTED, ALERT_GENERATED, ALERT_SENT, CUTOFF_RECOMMENDED, CUTOFF_APPROVED, CUTOFF_EXECUTED, INSPECTION_STARTED, INSPECTION_COMPLETED, RESTORE_APPROVED, RESTORE_EXECUTED
    target_type VARCHAR(50), -- 'node', 'equipment', 'alert', 'subscriber'
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
