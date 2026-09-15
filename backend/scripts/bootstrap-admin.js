// One-time bootstrap script: creates (or resets) an admin account with a real
// bcrypt hash. Needed because db/init/004_create_users.sql seeds users with
// the placeholder string '$2b$10$hashedPasswordHere', which is NOT a valid
// bcrypt hash and will never match any password - so the seeded 'admin' /
// 'operator' accounts cannot actually log in until you run this once.
//
// Usage (from the backend container or with the same env vars available):
//   node scripts/bootstrap-admin.js <username> <password> [role]
//
// Example (against the docker-compose stack):
//   docker compose exec backend node scripts/bootstrap-admin.js admin MyStrongPass123 admin

require("dotenv").config();
const bcrypt = require("bcrypt");
const pool = require("../db");

async function main() {
  const [, , username, password, role = "admin"] = process.argv;

  if (!username || !password) {
    console.error(
      "Usage: node scripts/bootstrap-admin.js <username> <password> [role]",
    );
    process.exit(1);
  }
  if (!["admin", "operator"].includes(role)) {
    console.error('role must be "admin" or "operator"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("password must be at least 8 characters");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await pool.query("SELECT id FROM users WHERE username=$1", [
    username,
  ]);

  if (existing.rows.length > 0) {
    await pool.query(
      "UPDATE users SET password_hash=$1, role=$2 WHERE username=$3",
      [passwordHash, role, username],
    );
    console.log(
      `Updated existing account "${username}" (role: ${role}) with a new password.`,
    );
  } else {
    await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ($1,$2,$3)",
      [username, passwordHash, role],
    );
    console.log(`Created account "${username}" (role: ${role}).`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Bootstrap failed:", err.message);
  process.exit(1);
});
