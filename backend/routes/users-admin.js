const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const pool = require("../db");
const { authMiddleware, requireRole } = require("../auth");
const { logAudit } = require("../utils/audit");
const { normalizeZoneCode } = require("../services/accessControl");

const ALLOWED_ROLES = ["admin", "operator", "resident"];
const SALT_ROUNDS = 10;

function closeUserConnections(req, userId) {
  const sockets = req.app.get("wss").clients;
  for (const socket of sockets) {
    if (socket.context?.user_id === userId) {
      socket.close(4003, "Account authorization changed");
    }
  }
}

// List dashboard accounts (never returns password_hash)
router.get("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, username, display_name, email, role, active, assigned_zone, created_at, last_login_at FROM users ORDER BY id",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new admin or operator account
router.post("/", authMiddleware, requireRole("admin"), async (req, res) => {
  const { username, password, role, phone, node_id } = req.body || {};
  const normalizedUsername = typeof username === "string" ? username.trim() : "";
  const normalizedPhone = typeof phone === "string" ? phone.trim() : "";
  const normalizedNodeId = typeof node_id === "string" ? node_id.trim() : "";
  if (
    !normalizedUsername ||
    typeof password !== "string" ||
    !password ||
    !role
  ) {
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
  if (role === "resident" && (!normalizedPhone || !normalizedNodeId)) {
    return res.status(400).json({ error: "resident accounts require phone and node_id" });
  }
  if (role === "resident" && normalizedUsername !== normalizedPhone) {
    return res.status(400).json({ error: "resident username must equal phone" });
  }

  let database;
  let transactionStarted = false;
  try {
    database = await pool.connect();
    await database.query("BEGIN");
    transactionStarted = true;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await database.query(
      "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at",
      [normalizedUsername, passwordHash, role],
    );
    if (role === "resident") {
      await database.query(
        "INSERT INTO subscribers (name, phone, node_id, role) VALUES ($1, $2, $3, 'resident')",
        [normalizedUsername, normalizedPhone, normalizedNodeId],
      );
    }
    await logAudit(
      null,
      req.user.user_id,
      "CREATE_USER",
      `username=${rows[0].username}; role=${rows[0].role}`,
      database,
    );
    await database.query("COMMIT");
    transactionStarted = false;
    res.status(201).json(rows[0]);
  } catch (err) {
    if (transactionStarted) {
      try {
        await database.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("User creation rollback failed", rollbackError);
      }
    }
    if (err.code === "23505") {
      return res.status(409).json({ error: "username or subscriber already exists" });
    }
    console.error("User creation failed", err);
    res.status(500).json({ error: "Unable to create account" });
  } finally {
    if (database) database.release();
  }
});

// Remove an admin/operator account
router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const id = req.params.id;
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: "invalid account id" });
    if (Number(id) === req.user.user_id) {
      return res
        .status(400)
        .json({ error: "You cannot delete your own account" });
    }

    let database;
    let transactionStarted = false;
    try {
      database = await pool.connect();
      await database.query("BEGIN");
      transactionStarted = true;
      const result = await database.query(
        "DELETE FROM users WHERE id = $1 AND role IN ('admin', 'operator') RETURNING id",
        [id],
      );
      if (!result.rowCount) {
        await database.query("ROLLBACK");
        transactionStarted = false;
        return res.status(404).json({ error: "account not found" });
      }
      await logAudit(
        null,
        req.user.user_id,
        "DELETE_USER",
        `user_id=${id}`,
        database,
      );
      await database.query("COMMIT");
      transactionStarted = false;
      closeUserConnections(req, Number(id));
      res.status(204).end();
    } catch (err) {
      if (transactionStarted) {
        try {
          await database.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("User deletion rollback failed", rollbackError);
        }
      }
      console.error("User deletion failed", err);
      res.status(500).json({ error: "Unable to delete account" });
    } finally {
      if (database) database.release();
    }
  },
);

router.patch("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "invalid account id" });
  const id = Number(req.params.id);
  const body = req.body || {};
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "invalid account id" });
  if (id === req.user.user_id && (body.role || body.active === false)) {
    return res.status(400).json({ error: "You cannot change your own role or deactivate your own account" });
  }
  const allowed = ["display_name", "email", "assigned_zone", "role", "active", "password"];
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) return res.status(400).json({ error: `unsupported fields: ${unknown.join(", ")}` });
  if (body.role && !ALLOWED_ROLES.includes(body.role)) return res.status(400).json({ error: "invalid role" });
  if (body.password !== undefined && (typeof body.password !== "string" || body.password.length < 8)) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }
  if (body.active !== undefined && typeof body.active !== "boolean") {
    return res.status(400).json({ error: "active must be a boolean" });
  }
  for (const key of ["display_name", "email"]) {
    if (body[key] !== undefined && body[key] !== null && typeof body[key] !== "string") {
      return res.status(400).json({ error: `${key} must be a string or null` });
    }
  }
  const updates = { ...body };
  let assignedZone = null;
  if (Object.hasOwn(body, "assigned_zone")) {
    const zoneCode = body.assigned_zone === null ? null : normalizeZoneCode(body.assigned_zone);
    if (body.assigned_zone !== null && !zoneCode) {
      return res.status(400).json({ error: "assigned_zone must be a valid zone code or null" });
    }
    assignedZone = zoneCode;
    updates.assigned_zone = zoneCode;
  }
  try {
    if (body.role === "resident") {
      const residentLink = await pool.query(
        `SELECT 1 FROM users
          WHERE id=$1 AND EXISTS (
            SELECT 1 FROM subscribers
             WHERE phone=users.username AND role='resident' AND active=TRUE
          )`,
        [id],
      );
      if (!residentLink.rows[0]) {
        return res.status(400).json({ error: "resident role requires an active subscriber record" });
      }
    }
    if (assignedZone) {
      const zone = await pool.query(
        "SELECT 1 FROM operational_zones WHERE zone_code=$1",
        [assignedZone],
      );
      if (!zone.rowCount) {
        return res.status(400).json({ error: "assigned zone does not exist" });
      }
    }

    const database = await pool.connect();
    let transactionStarted = false;
    try {
      await database.query("BEGIN");
      transactionStarted = true;
      const values = [];
      const assignments = [];
      for (const key of ["display_name", "email", "assigned_zone", "role", "active"]) {
        if (updates[key] !== undefined) {
          values.push(updates[key]);
          assignments.push(`${key}=$${values.length}`);
        }
      }
      if (updates.password) {
        values.push(await bcrypt.hash(updates.password, SALT_ROUNDS));
        assignments.push(`password_hash=$${values.length}`);
      }
      if (!assignments.length) {
        await database.query("ROLLBACK");
        transactionStarted = false;
        return res.status(400).json({ error: "no account changes supplied" });
      }
      values.push(id);
      const result = await database.query(
        `UPDATE users SET ${assignments.join(", ")}
          WHERE id=$${values.length}
          RETURNING id, username, display_name, email, role, active,
                    assigned_zone, created_at, last_login_at`,
        values,
      );
      if (!result.rowCount) {
        await database.query("ROLLBACK");
        transactionStarted = false;
        return res.status(404).json({ error: "account not found" });
      }
      await logAudit(
        null,
        req.user.user_id,
        "UPDATE_USER",
        `user_id=${id}; fields=${Object.keys(updates).join(",")}`,
        database,
      );
      await database.query("COMMIT");
      transactionStarted = false;
      closeUserConnections(req, id);
      res.json(result.rows[0]);
    } catch (error) {
      if (transactionStarted) {
        try {
          await database.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("User account rollback failed", rollbackError);
        }
      }
      throw error;
    } finally {
      database.release();
    }
  } catch (err) {
    console.error("User account update failed", err);
    res.status(500).json({ error: "Unable to update account" });
  }
});

module.exports = router;
