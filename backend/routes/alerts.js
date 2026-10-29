const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authMiddleware, requireAnyRole } = require("../auth");
const { logAudit } = require("../utils/audit");
const { canAccessZone, normalizeZoneCode } = require("../services/accessControl");

async function alertIsInOperatorScope(user, alertId, database = pool) {
  if (!user.assigned_zone) return false;
  const result = await database.query(
    `SELECT 1 FROM alerts a JOIN nodes n ON n.node_id=a.node_id
      WHERE a.id=$1 AND n.scope_zone=$2`,
    [alertId, normalizeZoneCode(user.assigned_zone)],
  );
  return result.rowCount > 0;
}

router.get(
  "/",
  authMiddleware,
  requireAnyRole(["admin", "operator"]),
  async (req, res) => {
    try {
      let query = "SELECT * FROM alerts";
      const values = [];
      if (req.user.role === "operator") {
        if (!req.user.assigned_zone) {
          return res.status(403).json({ error: "Operator zone is not configured" });
        }
        query += ` WHERE node_id IN (
          SELECT node_id FROM nodes
           WHERE scope_zone=$1
        )`;
        values.push(normalizeZoneCode(req.user.assigned_zone));
      }
      query += " ORDER BY id DESC";
      const { rows } = await pool.query(query, values);
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
    let database;
    let transactionStarted = false;
    try {
      database = await pool.connect();
      await database.query("BEGIN");
      transactionStarted = true;
      const { id } = req.params;
      if (req.user.role === "operator") {
        if (!req.user.assigned_zone) {
          await database.query("ROLLBACK");
          transactionStarted = false;
          return res.status(403).json({ error: "Operator zone is not configured" });
        }
        if (!(await alertIsInOperatorScope(req.user, id, database))) {
          await database.query("ROLLBACK");
          transactionStarted = false;
          return res.status(403).json({ error: "Alert outside assigned scope" });
        }
      }
      const { rows } = await database.query(
        `UPDATE alerts
            SET acknowledged=TRUE, acknowledged_by=$1, acknowledged_at=NOW()
          WHERE id=$2
            AND ($3::boolean OR EXISTS (
              SELECT 1 FROM nodes n
               WHERE n.node_id=alerts.node_id AND n.scope_zone=$4
            ))
          RETURNING *`,
        [
          req.user.username,
          id,
          req.user.role === "admin",
          normalizeZoneCode(req.user.assigned_zone),
        ],
      );
      if (!rows[0]) {
        await database.query("ROLLBACK");
        transactionStarted = false;
        return res.status(404).json({ error: "alert not found" });
      }
      await logAudit(null, req.user.user_id, "ACKNOWLEDGE_ALERT", `alert_id=${id}`, database);
      await database.query("COMMIT");
      transactionStarted = false;
      res.json(rows[0]);
    } catch (err) {
      if (transactionStarted) {
        try {
          await database.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Alert acknowledgement rollback failed", rollbackError);
        }
      }
      console.error("Alert acknowledgement failed", err);
      res.status(500).json({ error: "Unable to acknowledge alert" });
    } finally {
      if (database) database.release();
    }
  },
);

async function updateAlertState(req, res, state) {
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason || reason.length > 1000)
    return res.status(400).json({ error: "reason is required and must be at most 1000 characters" });
  let database;
  let transactionStarted = false;
  try {
    database = await pool.connect();
    await database.query("BEGIN");
    transactionStarted = true;
    if (req.user.role === "operator") {
      if (!req.user.assigned_zone) {
        await database.query("ROLLBACK");
        transactionStarted = false;
        return res.status(403).json({ error: "Operator zone is not configured" });
      }
      if (!(await alertIsInOperatorScope(req.user, req.params.id, database))) {
        await database.query("ROLLBACK");
        transactionStarted = false;
        return res.status(403).json({ error: "Alert outside assigned scope" });
      }
    }
    const result = await database.query(
      `UPDATE alerts
          SET resolution_status=$1, resolved_by=$2, resolved_at=NOW(), resolution_reason=$3
        WHERE id=$4
          AND ($5::boolean OR EXISTS (
            SELECT 1 FROM nodes n
             WHERE n.node_id=alerts.node_id AND n.scope_zone=$6
          ))
        RETURNING *`,
      [
        state,
        req.user.username,
        reason,
        req.params.id,
        req.user.role === "admin",
        normalizeZoneCode(req.user.assigned_zone),
      ],
    );
    if (!result.rowCount) {
      await database.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({ error: "alert not found" });
    }
    await logAudit(
      null,
      req.user.user_id,
      `ALERT_${state}`,
      `alert_id=${req.params.id}; reason=${reason}`,
      database,
    );
    await database.query("COMMIT");
    transactionStarted = false;
    res.json(result.rows[0]);
  } catch (err) {
    if (transactionStarted) {
      try {
        await database.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Alert state rollback failed", rollbackError);
      }
    }
    console.error("Alert state update failed", err);
    res.status(500).json({ error: "Unable to update alert state" });
  } finally {
    if (database) database.release();
  }
}

router.post("/:id/resolve", authMiddleware, requireAnyRole(["admin", "operator"]), (req, res) => updateAlertState(req, res, "RESOLVED"));
router.post("/:id/suppress", authMiddleware, requireAnyRole(["admin", "operator"]), (req, res) => updateAlertState(req, res, "SUPPRESSED"));

module.exports = router;
