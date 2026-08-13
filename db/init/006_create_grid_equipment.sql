CREATE TABLE grid_equipment (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    status VARCHAR(20) DEFAULT 'ON',
    recommended BOOLEAN DEFAULT FALSE,
    last_cutoff TIMESTAMP,
    description TEXT
);
