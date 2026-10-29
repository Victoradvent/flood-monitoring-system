-- Synthetic coordinates for disposable development/test databases only.
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

    INSERT INTO operational_zones (zone_code, display_name)
    VALUES (format('SIM-%s', lpad(node_number::TEXT, 3, '0')), areas[node_number])
    ON CONFLICT (zone_code) DO UPDATE
      SET display_name = EXCLUDED.display_name;

    INSERT INTO nodes (node_id, name, lat, lng, description, scope_zone)
    VALUES (
      format('NODE%s', lpad(node_number::TEXT, 3, '0')),
      format('%s simulated flood monitoring node', areas[node_number]),
      latitude,
      longitude,
      format('SIMULATED development location for %s; not a field installation', areas[node_number]),
      format('SIM-%s', lpad(node_number::TEXT, 3, '0'))
    )
    ON CONFLICT (node_id) DO UPDATE
    SET name = EXCLUDED.name,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        description = EXCLUDED.description,
        scope_zone = EXCLUDED.scope_zone;
  END LOOP;
END $$;
