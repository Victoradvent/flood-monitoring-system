const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/flood_monitoring',
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected PG client error', err);
});

module.exports = pool;
