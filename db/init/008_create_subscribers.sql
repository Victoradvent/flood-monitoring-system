-- Subscribers table for resident notifications
CREATE TABLE IF NOT EXISTS subscribers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  node_id TEXT NOT NULL,
  role TEXT DEFAULT 'resident', -- 'resident', 'operator', 'admin'
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(phone, node_id),
  FOREIGN KEY (node_id) REFERENCES nodes(node_id) ON DELETE CASCADE
);

CREATE INDEX idx_subscribers_node ON subscribers(node_id);
CREATE INDEX idx_subscribers_active ON subscribers(active);
CREATE INDEX idx_subscribers_phone ON subscribers(phone);

--  subscribers
INSERT INTO subscribers (name, phone, node_id, role, active)
VALUES 
  ('Resident A', '+2348000000001', 'NODE001', 'resident', TRUE),
  ('Resident B', '+2348000000002', 'NODE001', 'resident', TRUE),
  ('Operator Team', '+2348000000000', 'NODE001', 'operator', TRUE);
