const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authMiddleware, requireRole } = require("../auth");

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM nodes ORDER BY id");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { node_id, name, lat, lng, description } = req.body;
    if (!node_id) return res.status(400).json({ error: "node_id is required" });
    const { rows } = await pool.query(
      "INSERT INTO nodes (node_id, name, lat, lng, description) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [node_id, name || null, lat ?? null, lng ?? null, description || null],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, lat, lng, description } = req.body;
    const { rows } = await pool.query(
      "UPDATE nodes SET name=COALESCE($1,name), lat=COALESCE($2,lat), lng=COALESCE($3,lng), description=COALESCE($4,description) WHERE id=$5 RETURNING *",
      [name, lat, lng, description, id],
    );
    if (!rows[0]) return res.status(404).json({ error: "node not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query("DELETE FROM nodes WHERE id = $1", [id]);
      if (!result.rowCount)
        return res.status(404).json({ error: "node not found" });
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
