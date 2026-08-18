const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware, requireAnyRole, requireRole } = require('../auth');
const { logAudit } = require('../utils/audit');

// Get audit logs (JSON by default)
router.get('/', authMiddleware, requireAnyRole(['admin', 'operator']), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT a.id, g.name AS equipment_name, a.operator_id, a.action, a.timestamp, a.notes
      FROM audit_logs a
      LEFT JOIN grid_equipment g ON a.equipment_id = g.id
      ORDER BY a.timestamp DESC
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Filtered audit logs (JSON)
router.get('/filter', authMiddleware, requireAnyRole(['admin', 'operator']), async (req, res) => {
  const { start, end, operator, action } = req.query;
  const operatorId = req.user.user_id;

  try {
    await logAudit(null, operatorId, 'REPORT_VIEW', `Viewed logs with filters: start=${start}, end=${end}, operator=${operator}, action=${action}`);
  } catch (err) {
    console.error('Audit view log failed', err);
  }

  let query = `
    SELECT a.id, g.name AS equipment_name, a.operator_id, a.action, a.timestamp, a.notes
    FROM audit_logs a
    LEFT JOIN grid_equipment g ON a.equipment_id = g.id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  if (start) {
    query += ` AND a.timestamp >= $${idx++}`;
    params.push(start);
  }
  if (end) {
    query += ` AND a.timestamp <= $${idx++}`;
    params.push(end);
  }
  if (operator) {
    query += ` AND a.operator_id = $${idx++}`;
    params.push(operator);
  }
  if (action) {
    query += ` AND a.action = $${idx++}`;
    params.push(action);
  }

  query += ` ORDER BY a.timestamp DESC`;

  try {
    const r = await pool.query(query, params);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export audit logs as CSV
router.get('/export/csv', authMiddleware, requireRole('admin'), async (req, res) => {
  const { start, end, operator, action } = req.query;
  const operatorId = req.user.user_id;

  try {
    await logAudit(null, operatorId, 'REPORT_EXPORT', `Exported logs with filters: start=${start}, end=${end}, operator=${operator}, action=${action}`);
  } catch (err) {
    console.error('Audit export log failed', err);
  }

  let query = `
    SELECT g.name AS equipment_name, a.operator_id, a.action, a.timestamp, a.notes
    FROM audit_logs a
    LEFT JOIN grid_equipment g ON a.equipment_id = g.id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  if (start) {
    query += ` AND a.timestamp >= $${idx++}`;
    params.push(start);
  }
  if (end) {
    query += ` AND a.timestamp <= $${idx++}`;
    params.push(end);
  }
  if (operator) {
    query += ` AND a.operator_id = $${idx++}`;
    params.push(operator);
  }
  if (action) {
    query += ` AND a.action = $${idx++}`;
    params.push(action);
  }

  query += ` ORDER BY a.timestamp DESC`;

  try {
    const r = await pool.query(query, params);

    const header = 'Equipment,Operator,Action,Timestamp,Notes\n';
    const rows = r.rows.map(log =>
      `${log.equipment_name || ''},${log.operator_id},${log.action},${log.timestamp.toISOString()},${(log.notes || '').replace(/\n/g, ' ').replace(/,/g, ' ')}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
