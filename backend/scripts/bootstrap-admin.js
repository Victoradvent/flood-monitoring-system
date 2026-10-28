// One-time bootstrap script: creates or resets an administrator/operator
// account using a hidden interactive password prompt.
//
// Usage (from the backend container or with the same env vars available):
//   node scripts/bootstrap-admin.js <username> [role]
//
// Example (against the docker-compose stack):
//   docker compose exec backend node scripts/bootstrap-admin.js admin admin

require("dotenv").config();
const bcrypt = require("bcrypt");
const pool = require("../db");

function promptPassword() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Run this command from an interactive terminal");
  }

  return new Promise((resolve, reject) => {
    let password = "";
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdout.write("Password: ");
    stdin.setRawMode(true);
    stdin.resume();

    function finish(callback, value) {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      callback(value);
    }

    function onData(input) {
      const key = input.toString("utf8");
      if (key === "\u0003") {
        finish(reject, new Error("Password prompt cancelled"));
      } else if (key === "\r" || key === "\n") {
        finish(resolve, password);
      } else if (key === "\u007f" || key === "\b") {
        if (password.length > 0) {
          password = password.slice(0, -1);
          stdout.write("\b \b");
        }
      } else if ([...key].every((character) => character >= " ")) {
        password += key;
        stdout.write("*".repeat([...key].length));
      }
    }

    stdin.on("data", onData);
  });
}

async function main() {
  const [, , username, role = "admin"] = process.argv;

  if (!username || process.argv.length > 4) {
    console.error(
      "Usage: node scripts/bootstrap-admin.js <username> [role]",
    );
    process.exit(1);
  }
  if (!["admin", "operator"].includes(role)) {
    console.error('role must be "admin" or "operator"');
    process.exit(1);
  }
  const password = await promptPassword();
  if (!password) {
    console.error("password must not be empty");
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
