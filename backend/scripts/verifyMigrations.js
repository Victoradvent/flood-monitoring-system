const fs = require("node:fs/promises");
const path = require("node:path");
const { Client } = require("pg");

const migrationDirectory = path.resolve(__dirname, "../../db/init");
const migrationTestUrl = process.env.MIGRATION_TEST_DATABASE_URL;
if (!migrationTestUrl) {
  throw new Error("MIGRATION_TEST_DATABASE_URL is required");
}
const url = new URL(migrationTestUrl);
const adminDatabase = decodeURIComponent(url.pathname.slice(1));
const allowCreate = process.env.MIGRATION_TEST_ALLOW_CREATE_DATABASE === "true";

if (
  process.env.CI !== "true" ||
  !allowCreate ||
  !["127.0.0.1", "localhost", "::1"].includes(url.hostname) ||
  adminDatabase !== "postgres"
) {
  throw new Error(
    "Migration verification is CI-only and requires explicit opt-in plus a local PostgreSQL 'postgres' admin database",
  );
}

function databaseUrl(databaseName) {
  const result = new URL(url);
  result.pathname = `/${databaseName}`;
  return result.toString();
}

async function applyMigrations(database, files) {
  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationDirectory, file), "utf8");
    try {
      await database.query(sql);
    } catch (error) {
      throw new Error(`${file} failed: ${error.message}`, { cause: error });
    }
  }
}

async function assertEmptyDatabase(dbName) {
  const database = new Client({ connectionString: databaseUrl(dbName) });
  await database.connect();
  try {
    const result = await database.query(
      `SELECT to_regclass('public.operational_zones') AS zones,
              to_regclass('public.alert_recipients') AS recipients,
              EXISTS (SELECT 1 FROM pg_extension WHERE extname='postgis') AS postgis`,
    );
    if (
      result.rows[0].zones !== "operational_zones" ||
      result.rows[0].recipients !== "alert_recipients" ||
      result.rows[0].postgis !== true
    ) {
      throw new Error("Fresh schema is missing expected PostGIS tables or extension");
    }
  } finally {
    await database.end();
  }
}

async function assertUpgradePreservedData(dbName) {
  const database = new Client({ connectionString: databaseUrl(dbName) });
  await database.connect();
  try {
    const result = await database.query(
      `SELECT n.name AS node_name, ge.name AS equipment_name,
              ge.risk_zone, ge.historical_readings, ge.scope_zone
         FROM nodes n
         JOIN grid_equipment ge ON ge.name='Migration upgrade fixture'
        WHERE n.node_id='MIGRATION-UPGRADE-NODE'`,
    );
    const row = result.rows[0];
    if (
      !row ||
      row.node_name !== "Migration upgrade node" ||
      row.equipment_name !== "Migration upgrade fixture" ||
      row.risk_zone !== "MEDIUM" ||
      !Array.isArray(row.historical_readings) ||
      row.scope_zone !== null
    ) {
      throw new Error("Upgrade failed to preserve representative node/equipment data");
    }
    const user = await database.query(
      "SELECT id, assigned_zone FROM users WHERE username='migration-upgrade-operator'",
    );
    if (user.rows[0]?.assigned_zone !== "LEGACY-ZONE") {
      throw new Error("Upgrade failed to preserve the legacy operator assignment");
    }
    const alert = await database.query(
      `SELECT alert_level, water_level_cm
         FROM alerts
        WHERE node_id='MIGRATION-UPGRADE-NODE'`,
    );
    if (
      alert.rows[0]?.alert_level !== "WARNING" ||
      Number(alert.rows[0]?.water_level_cm) !== 42
    ) {
      throw new Error("Upgrade failed to preserve the representative alert");
    }
    const audit = await database.query(
      `SELECT equipment_id, operator_id, action, notes
         FROM audit_logs
        WHERE action='MIGRATION_UPGRADE_FIXTURE'`,
    );
    if (
      audit.rows[0]?.equipment_id === null ||
      audit.rows[0]?.equipment_id === undefined ||
      Number(audit.rows[0].operator_id) !== Number(user.rows[0].id) ||
      audit.rows[0].notes !== "Synthetic migration preservation fixture"
    ) {
      throw new Error("Upgrade failed to preserve the representative audit record");
    }
    const constraints = await database.query(
      `SELECT COUNT(*)::int AS count
         FROM pg_constraint
        WHERE conname IN (
          'nodes_scope_zone_fk',
          'grid_equipment_scope_zone_fk',
          'users_assigned_zone_fk'
        )`,
    );
    if (constraints.rows[0].count !== 3) {
      throw new Error("Authoritative zone scope foreign keys were not created");
    }
  } finally {
    await database.end();
  }
}

async function main() {
  const files = (await fs.readdir(migrationDirectory))
    .filter((file) => /^\d{3}_.+\.sql$/.test(file))
    .sort();
  const upgradeBoundary = "018_grid_equipment_metadata.sql";
  if (!files.includes(upgradeBoundary) || !files.includes("019_authoritative_zone_scopes.sql")) {
    throw new Error("Expected migrations 018 and 019 are not present");
  }

  const suffix = `${process.pid}_${Date.now()}`;
  const freshName = `fms_test_fresh_${suffix}`;
  const upgradeName = `fms_test_upgrade_${suffix}`;
  const admin = new Client({ connectionString: url.toString() });
  const createdDatabases = [];
  await admin.connect();
  try {
    for (const name of [freshName, upgradeName]) {
      await admin.query(`CREATE DATABASE "${name}"`);
      createdDatabases.push(name);
    }

    const fresh = new Client({ connectionString: databaseUrl(freshName) });
    await fresh.connect();
    try {
      await applyMigrations(fresh, files);
    } finally {
      await fresh.end();
    }
    await assertEmptyDatabase(freshName);
    console.log("PASS: empty database migration sequence and PostGIS schema");

    const upgrade = new Client({ connectionString: databaseUrl(upgradeName) });
    await upgrade.connect();
    try {
      const previousMigrations = files.filter((file) => file < upgradeBoundary);
      const laterMigrations = files.filter((file) => file >= upgradeBoundary);
      await applyMigrations(upgrade, previousMigrations);
      await upgrade.query(
        "INSERT INTO nodes (node_id, name) VALUES ($1, $2)",
        ["MIGRATION-UPGRADE-NODE", "Migration upgrade node"],
      );
      const equipment = await upgrade.query(
        "INSERT INTO grid_equipment (name) VALUES ($1) RETURNING id",
        ["Migration upgrade fixture"],
      );
      const operator = await upgrade.query(
        `INSERT INTO users (username, password_hash, role, assigned_zone)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ["migration-upgrade-operator", "synthetic-only", "operator", "LEGACY-ZONE"],
      );
      await upgrade.query(
        `INSERT INTO alerts (node_id, alert_level, water_level_cm)
         VALUES ($1, $2, $3)`,
        ["MIGRATION-UPGRADE-NODE", "WARNING", 42],
      );
      await upgrade.query(
        `INSERT INTO audit_logs (equipment_id, operator_id, action, notes)
         VALUES ($1, $2, $3, $4)`,
        [
          equipment.rows[0].id,
          operator.rows[0].id,
          "MIGRATION_UPGRADE_FIXTURE",
          "Synthetic migration preservation fixture",
        ],
      );
      await applyMigrations(upgrade, laterMigrations);
    } finally {
      await upgrade.end();
    }
    await assertUpgradePreservedData(upgradeName);
    console.log("PASS: upgrade from pre-018 schema preserves data and adds zone constraints");
  } finally {
    for (const name of createdDatabases.reverse()) {
      await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    }
    await admin.end();
  }
}

main().catch((error) => {
  console.error("Migration verification failed:", error.message);
  process.exitCode = 1;
});
