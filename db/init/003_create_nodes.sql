CREATE TABLE IF NOT EXISTS nodes (
  id BIGSERIAL PRIMARY KEY,
  node_id TEXT UNIQUE NOT NULL,
  name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

DO $$
DECLARE
  areas TEXT[] := ARRAY[
    'Awka North', 'Ifite', 'Amawbia', 'Nibo', 'Awka South', 'Okpuno',
    'Nise', 'Urum', 'Mgbakwu', 'Dunukofia', 'Ukpo', 'Abagana',
    'Njikoka', 'Enugwu-Ukwu', 'Nnewi North', 'Nnewi', 'Nnewi South',
    'Ekwusigo', 'Ozubulu', 'Ihiala', 'Uli', 'Okija', 'Orumba North',
    'Awgbu', 'Isuofia', 'Orumba South', 'Umunze', 'Aguata', 'Ekwulobia',
    'Oko', 'Orumba', 'Onitsha North', 'Onitsha', 'Onitsha South', 'Ogbaru',
    'Atani', 'Oyi', 'Awkuzu', 'Nteje', 'Anambra East', 'Otuocha',
    'Anambra West', 'Aguleri', 'Ayamelum', 'Anaku', 'Igbariam', 'Nzam',
    'Onitsha West', 'Idemili North', 'Idemili South', 'Oba', 'Nnewi Road',
    'Oraifite', 'Umunya', 'Ogbunike', 'Nkwelle-Ezunaka', 'Nkpor', 'Ogidi',
    'Eziowelle', 'Uke', 'Ihiala Road', 'Mbosi', 'Azia', 'Akwaeze',
    'Igbariam Junction', 'Nando', 'Omor', 'Ifite-Ogwari', 'Anam', 'Nmiata',
    'Umueri', 'Awka-Etiti'
  ];
  node_number INTEGER;
  latitude DOUBLE PRECISION;
  longitude DOUBLE PRECISION;
BEGIN
  FOR node_number IN 1..array_length(areas, 1) LOOP
    latitude := 5.75 + (abs(sin(node_number * 12.9898)) * 0.82);
    longitude := 6.75 + (abs(sin((node_number + 101) * 78.233)) * 0.5);

    INSERT INTO nodes (node_id, name, lat, lng, description)
    VALUES (
      format('NODE%s', lpad(node_number::TEXT, 3, '0')),
      format('%s flood monitoring node', areas[node_number]),
      latitude,
      longitude,
      format('Flood monitoring point in %s, Anambra State', areas[node_number])
    )
    ON CONFLICT (node_id) DO UPDATE
    SET name = EXCLUDED.name,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        description = EXCLUDED.description;
  END LOOP;
END $$;
