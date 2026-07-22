const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware, requireRole } = require('../auth');

// Trend analysis: compare last week vs previous week with alerts for spikes
router.get('/weekly-trends', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT DATE_TRUNC('week', timestamp) AS week, action, COUNT(*) AS count
      FROM audit_logs
      GROUP BY week, action
      ORDER BY week DESC, action
      LIMIT 20
    `);

    const weeks = [...new Set(r.rows.map(row => row.week))]
      .sort((a, b) => new Date(b) - new Date(a));
    const currentWeek = weeks[0];
    const prevWeek = weeks[1];

    const currentData = r.rows.filter(row => String(row.week) === String(currentWeek));
    const prevData = r.rows.filter(row => String(row.week) === String(prevWeek));

    const actions = [...new Set(r.rows.map(row => row.action))];
    const trends = actions.map(action => {
      const currentCount = Number(currentData.find(r => r.action === action)?.count || 0);
      const prevCount = Number(prevData.find(r => r.action === action)?.count || 0);
      const change = prevCount === 0 ? (currentCount > 0 ? 100 : 0) : ((currentCount - prevCount) / prevCount) * 100;
      return {
        action,
        currentCount,
        prevCount,
        change: Math.round(change)
      };
    });

    const alerts = trends
      .filter(t => t.action === 'CUTOFF' && t.currentCount > 50)
      .map(t => `ALERT: ${t.currentCount} cutoffs this week (threshold exceeded)`);

    res.json({ currentWeek, prevWeek, trends, alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
