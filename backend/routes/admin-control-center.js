const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authMiddleware, requireRole } = require("../auth");

router.use(authMiddleware, requireRole("admin"));

async function audit(userId, action, notes) {
  await pool.query(
    "INSERT INTO audit_logs (operator_id, action, notes) VALUES ($1, $2, $3)",
    [userId, action, notes],
  );
}

router.get("/overview", async (req, res) => {
  try {
    const [db, nodes, readings, alerts, delivery, subscribers, equipment, users, auditLogs, settings] = await Promise.all([
      pool.query("SELECT NOW() AS server_time"),
      pool.query(`SELECT n.*, r.timestamp AS last_reading_at, r.water_level_cm, r.battery_v, r.status
                    FROM nodes n LEFT JOIN LATERAL (SELECT timestamp, water_level_cm, battery_v, status
                      FROM readings WHERE node_id = n.node_id ORDER BY timestamp DESC LIMIT 1) r ON TRUE ORDER BY n.id`),
      pool.query("SELECT * FROM readings ORDER BY timestamp DESC LIMIT 100"),
      pool.query("SELECT * FROM alerts ORDER BY triggered_at DESC LIMIT 100"),
      pool.query(`SELECT ar.*, a.node_id, a.alert_level, a.water_level_cm, a.triggered_at,
                         s.name AS recipient_name, s.phone
                    FROM alert_recipients ar JOIN alerts a ON a.id = ar.alert_id
                    JOIN subscribers s ON s.id = ar.subscriber_id
                   ORDER BY ar.created_at DESC LIMIT 100`),
              pool.query("SELECT * FROM subscribers ORDER BY id"),
      pool.query("SELECT ge.*, ST_Y(ge.location::geometry) AS lat, ST_X(ge.location::geometry) AS lng FROM grid_equipment ge ORDER BY ge.id"),
      pool.query("SELECT id, username, display_name, email, role, created_at, last_login_at FROM users ORDER BY id"),
      pool.query(`SELECT a.id, a.operator_id, u.username, a.action, a.timestamp, a.notes
                    FROM audit_logs a LEFT JOIN users u ON u.id = a.operator_id
                   ORDER BY a.timestamp DESC LIMIT 100`),
      pool.query("SELECT setting_key, setting_value, updated_at FROM system_settings"),
    ]);
    res.json({
      health: { database: "UP", api: "UP", server_time: db.rows[0].server_time, mqtt: process.env.MQTT_BROKER ? "CONFIGURED" : "NOT_CONFIGURED", sms_provider: process.env.SMS_PROVIDER || "simulated" },
      nodes: nodes.rows,
      readings: readings.rows,
      alerts: alerts.rows,
      deliveries: delivery.rows,
      subscribers: subscribers.rows,
      equipment: equipment.rows,
      users: users.rows,
      audit: auditLogs.rows,
      settings: Object.fromEntries(settings.rows.map((row) => [row.setting_key, row.setting_value])),
    });
  } catch (err) {
    console.error("Admin control center overview error", err);
    res.status(500).json({ error: "Unable to load administrator telemetry", detail: err.message });
  }
});

router.post("/subscribers", async (req, res) => {
  const { name, phone, node_id, role = "resident" } = req.body || {};
  if (!name || !phone || !node_id) return res.status(400).json({ error: "name, phone and node_id are required" });
  try {
    const result = await pool.query("INSERT INTO subscribers (name, phone, node_id, role) VALUES ($1, $2, $3, $4) RETURNING *", [name, phone, node_id, role]);
    await audit(req.user.user_id, "CREATE_SUBSCRIBER", `subscriber_id=${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/subscribers/:id", async (req, res) => {
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) return res.status(400).json({ error: "reason is required" });
  try {
    const result = await pool.query("DELETE FROM subscribers WHERE id=$1", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "subscriber not found" });
    await audit(req.user.user_id, "DELETE_SUBSCRIBER", `subscriber_id=${req.params.id}; reason=${reason}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/thresholds", async (req, res) => {
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) return res.status(400).json({ error: "reason is required" });
  const warning = Number(req.body?.warning_cm);
  const critical = Number(req.body?.critical_cm);
  if (!Number.isFinite(warning) || !Number.isFinite(critical) || warning < 0 || critical <= warning) {
    return res.status(400).json({ error: "critical_cm must be greater than warning_cm" });
  }
  try {
    const value = { warning_cm: warning, critical_cm: critical };
    req.app.locals.thresholds = value;
    await pool.query(`INSERT INTO system_settings (setting_key, setting_value, updated_by)
      VALUES ('thresholds', $1::jsonb, $2)
      ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`, [JSON.stringify(value), req.user.user_id]);
    await audit(req.user.user_id, "UPDATE_THRESHOLDS", `${JSON.stringify(value)}; reason=${reason}`);
    res.json(value);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/nodes/:id", async (req, res) => {
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) return res.status(400).json({ error: "reason is required" });
  if (typeof req.body?.active !== "boolean") return res.status(400).json({ error: "active must be boolean" });
  try {
    const result = await pool.query("UPDATE nodes SET active = $1 WHERE id = $2 RETURNING *", [req.body.active, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "node not found" });
    await audit(req.user.user_id, req.body.active ? "ENABLE_NODE" : "DISABLE_NODE", `node_id=${result.rows[0].node_id}; reason=${reason}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/deliveries/:id/retry", async (req, res) => {
  try {
    const result = await pool.query(`UPDATE alert_recipients SET status='FAILED', next_attempt_at=NOW(), last_error=NULL
      WHERE id=$1 RETURNING id, alert_id, subscriber_id`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "delivery not found" });
    await audit(req.user.user_id, "RETRY_ALERT_DELIVERY", `delivery_id=${req.params.id}`);
    res.json({ queued: true, delivery: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/equipment/:id", async (req, res) => {
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) return res.status(400).json({ error: "reason is required" });
  const allowed = ["NORMAL", "CUTOFF_RECOMMENDED", "INSPECTION_REQUIRED", "CLEARED"];
  if (!allowed.includes(req.body?.status)) return res.status(400).json({ error: "invalid equipment status" });
  try {
    const result = await pool.query("UPDATE grid_equipment SET status=$1, description=COALESCE($2, description), recommended=($1 = 'CUTOFF_RECOMMENDED') WHERE id=$3 RETURNING *", [req.body.status, req.body.annotation || null, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "equipment not found" });
    await audit(req.user.user_id, "OVERRIDE_GRID_STATUS", `equipment_id=${req.params.id}; status=${req.body.status}; annotation=${req.body.annotation || ""}; reason=${reason}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/subscribers/:id", async (req, res) => {
  const { name, phone, node_id, active } = req.body || {};
  if (!name || !phone || !node_id || typeof active !== "boolean") return res.status(400).json({ error: "name, phone, node_id and active are required" });
  try {
    const result = await pool.query("UPDATE subscribers SET name=$1, phone=$2, node_id=$3, active=$4 WHERE id=$5 RETURNING *", [name, phone, node_id, active, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "subscriber not found" });
    await audit(req.user.user_id, "UPDATE_SUBSCRIBER", `subscriber_id=${req.params.id}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/simulations", async (req, res) => {
  const type = req.body?.type || "telemetry";
  await audit(req.user.user_id, "TRIGGER_SIMULATION", `type=${type}`);
  res.status(202).json({ recorded: true, type, message: "Simulation request recorded; invoke the simulator worker to generate telemetry" });
});

module.exports = router;