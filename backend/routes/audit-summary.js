const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authMiddleware, requireAnyRole } = require("../auth");

// Daily summary
router.get(
  "/daily",
  authMiddleware,
  requireAnyRole(["admin", "operator"]),
  async (req, res) => {
    try {
      const r = await pool.query(`
      SELECT DATE(timestamp) AS day, action, COUNT(*) AS count
      FROM audit_logs
      GROUP BY day, action
      ORDER BY day DESC, action
    `);
      res.json(r.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Weekly summary
router.get(
  "/weekly",
  authMiddleware,
  requireAnyRole(["admin", "operator"]),
  async (req, res) => {
    try {
      const r = await pool.query(`
      SELECT DATE_TRUNC('week', timestamp) AS week, action, COUNT(*) AS count
      FROM audit_logs
      GROUP BY week, action
      ORDER BY week DESC, action
    `);
      res.json(r.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
