const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM nodes ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, latitude, longitude, status = 'active' } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO nodes (name, latitude, longitude, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, latitude, longitude, status]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, latitude, longitude, status } = req.body;
    const { rows } = await pool.query(
      'UPDATE nodes SET name = COALESCE($1, name), latitude = COALESCE($2, latitude), longitude = COALESCE($3, longitude), status = COALESCE($4, status) WHERE id = $5 RETURNING *',
      [name, latitude, longitude, status, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM nodes WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
