CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    equipment_id INT REFERENCES grid_equipment(id) ON DELETE CASCADE,
    operator_id INT REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    notes TEXT
);
