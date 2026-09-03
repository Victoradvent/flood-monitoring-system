const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authMiddleware, requireRole } = require("../auth");

router.get("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM subscribers ORDER BY id");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { name, phone, node_id, role = "resident" } = req.body;
    if (!name || !phone || !node_id)
      return res
        .status(400)
        .json({ error: "name, phone and node_id are required" });
    const { rows } = await pool.query(
      "INSERT INTO subscribers (name, phone, node_id, role) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, phone, node_id, role],
    );
    res.status(201).json(rows[0]);
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
      await pool.query("DELETE FROM subscribers WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
