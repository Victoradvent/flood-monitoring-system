const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware, requireAnyRole } = require('../auth');
const { logAudit } = require('../utils/audit');

// Confirm inspection and restore power
router.post('/:id/inspect', authMiddleware, requireAnyRole(['admin', 'operator']), async (req, res) => {
  const id = req.params.id;
  const { notes } = req.body;

  try {
    const r = await pool.query(
      'UPDATE grid_equipment SET status=$1, description=$2, last_cutoff=NULL WHERE id=$3 RETURNING *',
      ['ON', `Inspection complete: ${notes || 'No notes provided'}`, id]
    );

    if (r.rowCount === 0) return res.status(404).json({ error: 'Equipment not found' });

    const equipment = r.rows[0];
    const inspectionNotified = req.app.get('inspectionNotified');
    if (inspectionNotified && inspectionNotified.delete) {
      inspectionNotified.delete(equipment.id);
    }

    req.app.get('wss').clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: 'inspection_complete',
          message: `Inspection confirmed. Power restored for ${equipment.name}.`,
          equipment
        }));
      }
    });

    try {
      await logAudit(id, req.user.id, 'INSPECTION', notes || 'No notes provided');
    } catch (err) {
      console.error('Audit log error', err);
    }

    res.json({ message: 'Inspection confirmed, power restored', equipment });
  } catch (err) {
    console.error('Inspection route error', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
