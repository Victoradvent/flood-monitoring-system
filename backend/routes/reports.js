const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authMiddleware, requireAnyRole } = require("../auth");
const { normalizeZoneCode } = require("../services/accessControl");

router.get("/", authMiddleware, requireAnyRole(["admin", "operator"]), async (req, res) => {
  try {
    if (req.user.role === "operator" && !req.user.assigned_zone) {
      return res.status(403).json({ error: "Operator zone is not configured" });
    }
    const operatorFilter = req.user.role === "operator";
    const values = operatorFilter ? [normalizeZoneCode(req.user.assigned_zone)] : [];
    const readingsQuery = `SELECT * FROM readings
      ${operatorFilter ? "WHERE node_id IN (SELECT node_id FROM nodes WHERE scope_zone=$1)" : ""}
      ORDER BY created_at DESC LIMIT 20`;
    const alertsQuery = `SELECT * FROM alerts
      ${operatorFilter ? "WHERE node_id IN (SELECT node_id FROM nodes WHERE scope_zone=$1)" : ""}
      ORDER BY created_at DESC LIMIT 20`;
    const [readingsRes, alertsRes] = await Promise.all([
      pool.query(readingsQuery, values),
      pool.query(alertsQuery, values),
    ]);

    res.json({
      summary: {
        readings: readingsRes.rowCount,
        alerts: alertsRes.rowCount,
      },
      recentReadings: readingsRes.rows,
      recentAlerts: alertsRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
