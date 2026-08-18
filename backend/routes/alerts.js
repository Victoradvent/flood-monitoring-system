const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware, requireAnyRole } = require('../auth');

router.get('/', authMiddleware, requireAnyRole(['admin', 'operator']), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM alerts ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/ack', authMiddleware, requireAnyRole(['admin', 'operator']), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      'UPDATE alerts SET acknowledged=TRUE, acknowledged_by=$1, acknowledged_at=NOW() WHERE id=$2 RETURNING *',
      [req.user.username, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'alert not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
