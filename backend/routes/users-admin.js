const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const pool = require("../db");
const { authMiddleware, requireRole } = require("../auth");
const { logAudit } = require("../utils/audit");

const ALLOWED_ROLES = ["admin", "operator", "resident"];
const SALT_ROUNDS = 10;

// List dashboard accounts (never returns password_hash)
router.get("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, username, display_name, email, role, active, created_at, last_login_at FROM users ORDER BY id",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new admin or operator account
router.post("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { username, password, role, phone, node_id } = req.body;

    if (!username || !password || !role) {
      return res
        .status(400)
        .json({ error: "username, password and role are required" });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return res
        .status(400)
        .json({ error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "password must be at least 8 characters" });
    }
    if (role === "resident" && (!phone || !node_id)) {
      return res.status(400).json({ error: "resident accounts require phone and node_id" });
    }
    if (role === "resident" && username !== phone) {
      return res.status(400).json({ error: "resident username must equal phone" });
    }

    const existing = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username],
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at",
      [username, passwordHash, role],
    );
    if (role === "resident") {
      await pool.query(
        "INSERT INTO subscribers (name, phone, node_id, role) VALUES ($1, $2, $3, 'resident')",
        [username, phone, node_id],
      );
    }

    await logAudit(null, req.user.user_id, "CREATE_USER", `username=${rows[0].username}; role=${rows[0].role}`);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove an admin/operator account
router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (Number(id) === req.user.user_id) {
        return res
          .status(400)
          .json({ error: "You cannot delete your own account" });
      }

      const result = await pool.query(
        "DELETE FROM users WHERE id = $1 AND role IN ('admin', 'operator')",
        [id],
      );

      if (!result.rowCount)
        return res.status(404).json({ error: "account not found" });
      await logAudit(null, req.user.user_id, "DELETE_USER", `user_id=${id}`);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.patch("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid account id" });
  if (id === req.user.user_id && (req.body?.role || req.body?.active === false)) {
    return res.status(400).json({ error: "You cannot change your own role or deactivate your own account" });
  }
  const allowed = ["display_name", "email", "assigned_zone", "role", "active", "password"];
  const unknown = Object.keys(req.body || {}).filter((key) => !allowed.includes(key));
  if (unknown.length) return res.status(400).json({ error: `unsupported fields: ${unknown.join(", ")}` });
  if (req.body.role && !ALLOWED_ROLES.includes(req.body.role)) return res.status(400).json({ error: "invalid role" });
  if (req.body.role === "resident") {
    const residentLink = await pool.query("SELECT 1 FROM users WHERE id=$1 AND EXISTS (SELECT 1 FROM subscribers WHERE phone=users.username AND role='resident' AND active=TRUE)", [id]);
    if (!residentLink.rows[0]) return res.status(400).json({ error: "resident role requires an active subscriber record" });
  }
  if (req.body.password && req.body.password.length < 8) return res.status(400).json({ error: "password must be at least 8 characters" });
  try {
    const values = [];
    const assignments = [];
    for (const key of ["display_name", "email", "assigned_zone", "role", "active"]) {
      if (req.body[key] !== undefined) {
        values.push(req.body[key]);
        assignments.push(`${key}=$${values.length}`);
      }
    }
    if (req.body.password) {
      values.push(await bcrypt.hash(req.body.password, SALT_ROUNDS));
      assignments.push(`password_hash=$${values.length}`);
    }
    if (!assignments.length) return res.status(400).json({ error: "no account changes supplied" });
    values.push(id);
    const result = await pool.query(`UPDATE users SET ${assignments.join(", ")} WHERE id=$${values.length} RETURNING id, username, display_name, email, role, active, created_at, last_login_at`, values);
    if (!result.rowCount) return res.status(404).json({ error: "account not found" });
    await logAudit(null, req.user.user_id, "UPDATE_USER", `user_id=${id}; fields=${Object.keys(req.body).join(",")}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
