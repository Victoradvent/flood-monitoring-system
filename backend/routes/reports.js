const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const [readingsRes, alertsRes] = await Promise.all([
      pool.query("SELECT * FROM readings ORDER BY created_at DESC LIMIT 20"),
      pool.query("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 20"),
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
