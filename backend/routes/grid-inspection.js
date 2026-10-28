const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authMiddleware, requireAnyRole } = require("../auth");
const { logAudit } = require("../utils/audit");

// Confirm an inspection. This clears the recommendation; it does not restore power.
router.post(
  "/:id/inspect",
  authMiddleware,
  requireAnyRole(["admin", "operator"]),
  async (req, res) => {
    const id = req.params.id;
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
    if (!notes) return res.status(400).json({ error: "inspection notes are required" });
    let database;
    let transactionStarted = false;

    try {
      database = await pool.connect();
      await database.query("BEGIN");
      transactionStarted = true;
      const r = await database.query(
        `UPDATE grid_equipment SET status='CLEARED', recommended=FALSE, recommended_at=NULL
       WHERE id=$1 RETURNING *`,
        [id],
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

      req.app.get("wss").clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(
            JSON.stringify({
              type: "inspection_complete",
              message: `Inspection confirmed and recommendation cleared for ${equipment.name}.`,
              equipment,
            }),
          );
        }
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
