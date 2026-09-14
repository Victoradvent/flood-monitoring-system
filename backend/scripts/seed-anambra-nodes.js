require("dotenv").config();
const pool = require("../db");

const areas = [
  "Awka North",
  "Ifite",
  "Amawbia",
  "Nibo",
  "Awka South",
  "Okpuno",
  "Nise",
  "Urum",
  "Mgbakwu",
  "Dunukofia",
  "Ukpo",
  "Abagana",
  "Njikoka",
  "Enugwu-Ukwu",
  "Nnewi North",
  "Nnewi",
  "Nnewi South",
  "Ekwusigo",
  "Ozubulu",
  "Ihiala",
  "Uli",
  "Okija",
  "Orumba North",
  "Awgbu",
  "Isuofia",
  "Orumba South",
  "Umunze",
  "Aguata",
  "Ekwulobia",
  "Oko",
  "Orumba",
  "Onitsha North",
  "Onitsha",
  "Onitsha South",
  "Ogbaru",
  "Atani",
  "Oyi",
  "Awkuzu",
  "Nteje",
  "Anambra East",
  "Otuocha",
  "Anambra West",
  "Aguleri",
  "Ayamelum",
  "Anaku",
  "Igbariam",
  "Nzam",
  "Onitsha West",
  "Idemili North",
  "Idemili South",
  "Oba",
  "Nnewi Road",
  "Oraifite",
  "Umunya",
  "Ogbunike",
  "Nkwelle-Ezunaka",
  "Nkpor",
  "Ogidi",
  "Eziowelle",
  "Uke",
  "Ihiala Road",
  "Mbosi",
  "Azia",
  "Akwaeze",
  "Igbariam Junction",
  "Nando",
  "Omor",
  "Ifite-Ogwari",
  "Anam",
  "Nmiata",
  "Umueri",
  "Awka-Etiti",
];

function scatteredCoordinate(index) {
  const random = (seed) => {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  };
  const latitudeOffset = random(index + 1);
  const longitudeOffset = random(index + 101);

  return {
    lat: 5.75 + latitudeOffset * 0.82,
    lng: 6.75 + longitudeOffset * 0.5,
  };
}

async function seedNodes() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const [index, area] of areas.entries()) {
      const nodeId = `NODE${String(index + 1).padStart(3, "0")}`;
      const { lat, lng } = scatteredCoordinate(index);
      await client.query(
        `INSERT INTO nodes (node_id, name, lat, lng, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (node_id) DO UPDATE
         SET name = EXCLUDED.name,
             lat = EXCLUDED.lat,
             lng = EXCLUDED.lng,
             description = EXCLUDED.description`,
        [
          nodeId,
          `${area} flood monitoring node`,
          lat,
          lng,
          `Flood monitoring point in ${area}, Anambra State`,
        ],
      );
    }

    await client.query("COMMIT");
    console.log(`Seeded ${areas.length} scattered nodes across Anambra State.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedNodes().catch((error) => {
  console.error("Node seed failed:", error.message);
  process.exitCode = 1;
});
