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
    const { notes } = req.body;

    try {
      const r = await pool.query(
        `UPDATE grid_equipment SET status='CLEARED', recommended=FALSE, description=$1
       WHERE id=$2 RETURNING *`,
        [`Inspection complete: ${notes || "No notes provided"}`, id],
      );

      if (r.rowCount === 0)
        return res.status(404).json({ error: "Equipment not found" });

      const equipment = r.rows[0];
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

      try {
        await logAudit(
          id,
          req.user.user_id,
          "INSPECTION_COMPLETED",
          notes || "No notes provided",
        );
      } catch (err) {
        console.error("Audit log error", err);
      }

      res.json({
        message: "Inspection confirmed; cutoff recommendation cleared",
        equipment,
      });
    } catch (err) {
      console.error("Inspection route error", err);
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
