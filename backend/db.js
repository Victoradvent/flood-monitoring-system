const { Pool } = require("pg");

// Use DATABASE_URL if available, otherwise build from individual vars
let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  const PG_USER =
    process.env.PG_USER || process.env.POSTGRES_USER || "postgres";
  const PG_PASS =
    process.env.PG_PASS || process.env.POSTGRES_PASSWORD || "postgres";
  const PG_HOST = process.env.PG_HOST || "localhost";
  const PG_PORT = process.env.PG_PORT || 5432;
  const PG_DB =
    process.env.PG_DB || process.env.POSTGRES_DB || "flood_monitoring";

  connectionString = `postgres://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}`;
}

const pool = new Pool({
  connectionString,
  ssl:
    process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Unexpected PG client error", err);
});

module.exports = pool;
