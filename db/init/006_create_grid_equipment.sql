CREATE TABLE grid_equipment (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    status VARCHAR(32) NOT NULL DEFAULT 'NORMAL'
      CHECK (status IN ('NORMAL', 'CUTOFF_RECOMMENDED', 'INSPECTION_REQUIRED', 'CLEARED')),
    recommended BOOLEAN DEFAULT FALSE,
    recommended_at TIMESTAMP WITH TIME ZONE,
    description TEXT
);
