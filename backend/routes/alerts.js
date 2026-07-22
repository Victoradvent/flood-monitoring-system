const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM alerts ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/ack', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      'UPDATE alerts SET acknowledged = TRUE, acknowledged_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
