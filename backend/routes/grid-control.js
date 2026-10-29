const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authMiddleware, requireAnyRole } = require("../auth");
const { logAudit } = require("../utils/audit");
const { normalizeZoneCode } = require("../services/accessControl");

// List all grid equipment
router.get(
  "/",
  authMiddleware,
  requireAnyRole(["admin", "operator"]),
  async (req, res) => {
    try {
      const operator = req.user.role === "operator";
      const zone = normalizeZoneCode(req.user.assigned_zone);
      if (operator && !zone) {
        return res.status(403).json({ error: "Operator zone is not configured" });
      }
      const r = await pool.query(
        `SELECT ge.*, ST_Y(ge.location::geometry) AS lat,
                ST_X(ge.location::geometry) AS lng
           FROM grid_equipment ge
          WHERE $1::boolean OR ge.scope_zone=$2
          ORDER BY ge.id`,
        [!operator, zone],
      );
      res.json(r.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Recommend cutoff for specific equipment without changing power state
router.post(
  "/:id/cutoff",
  authMiddleware,
  requireAnyRole(["admin", "operator"]),
  async (req, res) => {
    const id = req.params.id;
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: "Invalid equipment id" });
    const operator = req.user.role === "operator";
    const zone = normalizeZoneCode(req.user.assigned_zone);
    if (operator && !zone) {
      return res.status(403).json({ error: "Operator zone is not configured" });
    }
    let database;
    let transactionStarted = false;
    try {
      database = await pool.connect();
      await database.query("BEGIN");
      transactionStarted = true;
      const updateRes = await database.query(
        `UPDATE grid_equipment SET recommended=TRUE, status='CUTOFF_RECOMMENDED',
       recommended_at=NOW() WHERE id=$1 AND ($2::boolean OR scope_zone=$3) RETURNING *`,
        [id, !operator, zone],
      );
      if (updateRes.rowCount === 0) {
        await database.query("ROLLBACK");
        transactionStarted = false;
        return res.status(404).json({ error: "Equipment not found" });
      }
      const equipment = updateRes.rows[0];
      await logAudit(
        id,
        req.user.user_id,
        "RECOMMEND_CUTOFF",
        "Manual cutoff recommendation issued",
        database,
      );
      await database.query("COMMIT");
      transactionStarted = false;

      req.app.get("broadcast")({
        type: "grid_recommendation",
        equipment,
        message: `Cutoff recommended for ${equipment.name}.`,
      });

      res.json({ message: "Cutoff recommendation issued", equipment });
    } catch (err) {
      if (transactionStarted) {
        try {
          await database.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Grid recommendation rollback failed", rollbackError);
        }
      }
      console.error("Grid recommendation failed", err);
      res.status(500).json({ error: "Unable to issue cutoff recommendation" });
    } finally {
      if (database) database.release();
    }
  },
);

// Physical restoration is deliberately not implemented in recommendation-only mode.
router.post(
  "/:id/restore",
  authMiddleware,
  requireAnyRole(["admin", "operator"]),
  async (req, res) => {
    res
      .status(409)
      .json({
        error:
          "This deployment is recommendation-only; no physical power control is available.",
      });
  },
);

module.exports = router;
