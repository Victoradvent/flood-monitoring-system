const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware, requireAnyRole, requireRole } = require('../auth');
const { logAudit } = require('../utils/audit');

// List all grid equipment
router.get('/', authMiddleware, requireAnyRole(['admin', 'operator']), async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM grid_equipment ORDER BY id');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recommend cutoff for specific equipment without changing power state
router.post('/:id/cutoff', authMiddleware, requireRole('operator'), async (req, res) => {
  const id = req.params.id;
  try {
    const equipmentRes = await pool.query('SELECT * FROM grid_equipment WHERE id=$1', [id]);
    if (equipmentRes.rowCount === 0) return res.status(404).json({ error: 'Equipment not found' });

    const updateRes = await pool.query(
      'UPDATE grid_equipment SET recommended=$1 WHERE id=$2 RETURNING *',
      [true, id]
    );
    const equipment = updateRes.rows[0];

    // Broadcast recommendation to dashboard
    req.app.get('wss').clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'grid_recommendation', equipment, message: `Cutoff recommended for ${equipment.name}.` }));
      }
    });

    try {
      await logAudit(id, req.user.id, 'RECOMMEND_CUTOFF', 'Manual cutoff recommendation issued');
    } catch (err) {
      console.error('Audit log error', err);
    }

    res.json({ message: 'Cutoff recommendation issued', equipment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore power
router.post('/:id/restore', authMiddleware, requireRole('operator'), async (req, res) => {
  const id = req.params.id;
  try {
    const r = await pool.query(
      'UPDATE grid_equipment SET status=$1 WHERE id=$2 AND last_cutoff IS NULL RETURNING *',
      ['ON', id]
    );
    if (r.rowCount === 0) {
      return res.status(400).json({ error: 'Equipment cannot be restored until inspection is confirmed' });
    }

    res.json({ message: 'Power restored', equipment: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
