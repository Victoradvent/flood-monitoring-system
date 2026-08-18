ALTER TABLE readings
ADD CONSTRAINT fk_readings_node
FOREIGN KEY (node_id)
REFERENCES nodes(node_id)
ON DELETE CASCADE;

ALTER TABLE alerts
ADD CONSTRAINT fk_alerts_node
FOREIGN KEY (node_id)
REFERENCES nodes(node_id)
ON DELETE CASCADE;