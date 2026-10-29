const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authMiddleware, requireAnyRole } = require("../auth");
const { logAudit } = require("../utils/audit");
const { normalizeZoneCode } = require("../services/accessControl");

// Confirm an inspection. This clears the recommendation; it does not restore power.
router.post(
  "/:id/inspect",
  authMiddleware,
  requireAnyRole(["admin", "operator"]),
  async (req, res) => {
    const id = req.params.id;
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: "Invalid equipment id" });
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
    if (!notes) return res.status(400).json({ error: "inspection notes are required" });
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
      const r = await database.query(
        `UPDATE grid_equipment SET status='CLEARED', recommended=FALSE, recommended_at=NULL
       WHERE id=$1 AND ($2::boolean OR scope_zone=$3) RETURNING *`,
        [id, !operator, zone],
      );

      if (r.rowCount === 0) {
        await database.query("ROLLBACK");
        transactionStarted = false;
        return res.status(404).json({ error: "Equipment not found" });
      }

      const equipment = r.rows[0];
      await logAudit(
        id,
        req.user.user_id,
        "INSPECTION_COMPLETED",
        notes,
        database,
      );
      await database.query("COMMIT");
      transactionStarted = false;

      const inspectionNotified = req.app.get("inspectionNotified");
      if (inspectionNotified && inspectionNotified.delete) {
        inspectionNotified.delete(equipment.id);
      }

      req.app.get("broadcast")({
        type: "inspection_complete",
        message: `Inspection confirmed and recommendation cleared for ${equipment.name}.`,
        equipment,
      });

      res.json({
        message: "Inspection confirmed; cutoff recommendation cleared",
        equipment,
      });
    } catch (err) {
      if (transactionStarted) {
        try {
          await database.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Inspection transaction rollback failed", rollbackError);
        }
      }
      console.error("Inspection route error", err);
      res.status(500).json({ error: "Unable to record inspection" });
    } finally {
      if (database) database.release();
    }
  },
);

module.exports = router;
