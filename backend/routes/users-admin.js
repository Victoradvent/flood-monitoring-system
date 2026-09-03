const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const pool = require("../db");
const { authMiddleware, requireRole } = require("../auth");

const ALLOWED_ROLES = ["admin", "operator"];
const SALT_ROUNDS = 10;

// List dashboard accounts (never returns password_hash)
router.get("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, username, role, created_at FROM users ORDER BY id",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new admin or operator account
router.post("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { username, password, role } = req.body;

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
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
