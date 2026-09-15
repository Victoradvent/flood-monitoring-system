const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authMiddleware, requireAnyRole, requireRole } = require("../auth");
const { logAudit } = require("../utils/audit");

router.get("/", authMiddleware, requireAnyRole(["admin", "operator", "resident"]), async (req, res) => {
  try {
    const query = req.user.role === "resident"
      ? `SELECT n.node_id, n.name, n.description, n.lat, n.lng, n.active
           FROM nodes n JOIN subscribers s ON s.node_id = n.node_id
          WHERE s.phone = $1 AND s.role = 'resident' AND s.active = TRUE ORDER BY n.id`
      : "SELECT * FROM nodes ORDER BY id";
    const { rows } = await pool.query(query, req.user.role === "resident" ? [req.user.username] : []);
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
    await logAudit(null, req.user.user_id, "CREATE_NODE", `node_id=${rows[0].node_id}`);
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
    await logAudit(null, req.user.user_id, "UPDATE_NODE", `node_id=${rows[0].node_id}`);
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
      await logAudit(null, req.user.user_id, "DELETE_NODE", `node_id=${id}`);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
