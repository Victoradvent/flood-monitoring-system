-- Synthetic contacts for disposable development/test databases only.
INSERT INTO subscribers (name, phone, node_id, role, active)
VALUES
  ('Simulated Resident A', '+2348000000001', 'NODE001', 'resident', TRUE),
  ('Simulated Resident B', '+2348000000002', 'NODE001', 'resident', TRUE),
  ('Simulated Operator Team', '+2348000000000', 'NODE001', 'operator', TRUE);
