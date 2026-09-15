const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authMiddleware, requireAnyRole } = require("../auth");
const { logAudit } = require("../utils/audit");

router.get(
  "/",
  authMiddleware,
  requireAnyRole(["admin", "operator"]),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM alerts ORDER BY id DESC",
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.post(
  "/:id/ack",
  authMiddleware,
  requireAnyRole(["admin", "operator"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { rows } = await pool.query(
        "UPDATE alerts SET acknowledged=TRUE, acknowledged_by=$1, acknowledged_at=NOW() WHERE id=$2 RETURNING *",
        [req.user.username, id],
      );
      if (!rows[0]) return res.status(404).json({ error: "alert not found" });
      await logAudit(null, req.user.user_id, "ACKNOWLEDGE_ALERT", `alert_id=${id}`);
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

async function updateAlertState(req, res, state) {
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) return res.status(400).json({ error: "reason is required" });
  try {
    const result = await pool.query(
      "UPDATE alerts SET resolution_status=$1, resolved_by=$2, resolved_at=NOW(), resolution_reason=$3 WHERE id=$4 RETURNING *",
      [state, req.user.username, reason, req.params.id],
    );
    if (!result.rowCount) return res.status(404).json({ error: "alert not found" });
    await logAudit(null, req.user.user_id, `ALERT_${state}`, `alert_id=${req.params.id}; reason=${reason}`);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

router.post("/:id/resolve", authMiddleware, requireAnyRole(["admin", "operator"]), (req, res) => updateAlertState(req, res, "RESOLVED"));
router.post("/:id/suppress", authMiddleware, requireAnyRole(["admin", "operator"]), (req, res) => updateAlertState(req, res, "SUPPRESSED"));

module.exports = router;
