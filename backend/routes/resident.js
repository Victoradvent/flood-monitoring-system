const express = require('express');
const router = express.Router();
const pool = require('../db');

// Residents are not dashboard "users" - they exist only as rows in `subscribers`
// (name, phone, node_id, role='resident'), the same table SMS alerts are sent from.
// So instead of a username/password login, a resident identifies themselves by the
// phone number they registered with, and we hand back ONLY the node(s) tied to
// that phone - never the full node list, grid equipment, audit logs, or other
// residents' data.
//
// Production note: a bare phone lookup is guessable. Before going live, put an
// OTP/SMS confirmation step in front of this route (Africa's Talking can send the
// code) or rate-limit by IP. Left out here to keep the endpoint runnable as-is.

function normalizePhone(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function safetyMessage(status) {
  if (status === 'CRITICAL') {
    return 'Water levels are critical near your area. Move to higher ground and stay away from electrical equipment and transformers.';
  }
  if (status === 'WARNING') {
    return 'Water levels are rising near your area. Stay alert, avoid low-lying routes, and keep away from electrical equipment.';
  }
  return 'Water levels near your area are normal. No action needed right now.';
}

router.get('/status', async (req, res) => {
  const phone = normalizePhone(req.query.phone);
  if (!phone) {
    return res.status(400).json({ error: 'phone query parameter is required' });
  }

  try {
    const subResult = await pool.query(
      `SELECT s.id, s.name, s.node_id
         FROM subscribers s
        WHERE s.phone = $1 AND s.role = 'resident' AND s.active = TRUE`,
      [phone]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No registered address found for this phone number. Contact your local coordinator to be added.'
      });
    }

    const residentName = subResult.rows[0].name;
    const nodeIds = [...new Set(subResult.rows.map(r => r.node_id))];

    const nodes = [];
    for (const nodeId of nodeIds) {
      const nodeResult = await pool.query(
        'SELECT node_id, name, description, lat, lng FROM nodes WHERE node_id = $1',
        [nodeId]
      );
      if (nodeResult.rows.length === 0) continue;
      const node = nodeResult.rows[0];

      const latestReading = await pool.query(
        `SELECT water_level_cm, status, timestamp
           FROM readings
          WHERE node_id = $1
          ORDER BY timestamp DESC
          LIMIT 1`,
        [nodeId]
      );

      const recentAlerts = await pool.query(
        `SELECT alert_level, water_level_cm, triggered_at
           FROM alerts
          WHERE node_id = $1 AND alert_level IN ('WARNING', 'CRITICAL')
          ORDER BY triggered_at DESC
          LIMIT 5`,
        [nodeId]
      );

      const current = latestReading.rows[0] || null;
      const status = current?.status || 'NORMAL';

      nodes.push({
        node_id: node.node_id,
        name: node.name || node.node_id,
        description: node.description,
        lat: node.lat,
        lng: node.lng,
        status,
        water_level_cm: current?.water_level_cm ?? null,
        last_update: current?.timestamp ?? null,
        safety_message: safetyMessage(status),
        recent_alerts: recentAlerts.rows.map(a => ({
          level: a.alert_level,
          water_level_cm: a.water_level_cm,
          triggered_at: a.triggered_at
        }))
      });
    }

    res.json({ resident_name: residentName, nodes });
  } catch (err) {
    console.error('Resident status lookup error', err);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
