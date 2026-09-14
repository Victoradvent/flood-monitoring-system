// app.js - Node.js MQTT subscriber + alert handler
require("dotenv").config();
const mqtt = require("mqtt");
const express = require("express");
const WebSocket = require("ws");
const axios = require("axios");
const Twilio = require("twilio");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cors = require("cors");
const fs = require("fs");
const { createSmsProvider } = require("./services/smsProvider");
const { logAudit } = require("./utils/audit");
const {
  authenticateToken,
  authMiddleware,
  requireRole,
  requireAnyRole,
} = require("./auth");

// Shared modules
const pool = require("./db");

// Route modules
const gridControl = require("./routes/grid-control");
const auditRoutes = require("./routes/audit");
const auditSummary = require("./routes/audit-summary");
const auditTrends = require("./routes/audit-trends");
const alertRoutes = require("./routes/alerts");
const nodeRoutes = require("./routes/nodes");
const reportsRoutes = require("./routes/reports");
const gridInspection = require("./routes/grid-inspection");
const subscribersRoutes = require("./routes/subscribers-admin");
const residentRoutes = require("./routes/resident");
const usersAdminRoutes = require("./routes/users-admin");

// Config
const {
  MQTT_BROKER,
  MQTT_PORT,
  MQTT_USER,
  MQTT_PASS,
  MQTT_TOPIC,
  PG_HOST,
  PG_PORT,
  PG_USER,
  PG_PASS,
  PG_DB,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM,
  SMS_GATEWAY_URL,
  SMS_GATEWAY_APIKEY,
  SMS_GATEWAY_FROM,
  ALERT_COOLDOWN_SEC = 900,
  WARNING_LEVEL_CM = 30,
  CRITICAL_LEVEL_CM = 50,
  SMS_PROVIDER = "simulated",
  SMS_SIM_FAILURE_RATE = 0.2,
  SMS_SIM_RATE_LIMIT = 10,
  SMS_SIM_MIN_DELAY_MS = 100,
  SMS_SIM_MAX_DELAY_MS = 500,
  SMS_SIM_SEED = "fms-sms",
  MQTT_TLS = "false",
  MQTT_CA_FILE,
  PORT = 3000,
} = process.env;

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required");
  process.exit(1);
}
const mqttUrl = `${String(MQTT_TLS).toLowerCase() === "true" ? "mqtts" : "mqtt"}://${MQTT_BROKER}:${MQTT_PORT}`;

// Twilio client (if configured)
const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

const smsProvider = createSmsProvider({
  mode: SMS_PROVIDER,
  twilioClient,
  from: TWILIO_FROM || SMS_GATEWAY_FROM,
  gatewayUrl: SMS_GATEWAY_URL,
  gatewayApiKey: SMS_GATEWAY_APIKEY,
  failureRate: SMS_SIM_FAILURE_RATE,
  rateLimitPerMinute: SMS_SIM_RATE_LIMIT,
  minDelayMs: SMS_SIM_MIN_DELAY_MS,
  maxDelayMs: SMS_SIM_MAX_DELAY_MS,
  seed: SMS_SIM_SEED,
});

// In-memory cooldown map: { "<node_id>::<level>": timestamp }
const cooldownMap = new Map();
const nodeStatusMap = new Map();

// WebSocket server for dashboard
const app = express();
const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });
app.set("wss", wss);
app.use(cors());
app.use(express.json());

// Broadcast helper
function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// Simple health endpoint
app.get("/health", (req, res) => res.json({ status: "NORMAL" }));

// Mount all routes
app.use("/grid", gridControl);
app.use("/audit", auditRoutes);
app.use("/audit-summary", auditSummary);
app.use("/audit-trends", auditTrends);
app.use("/alerts", alertRoutes);
app.use("/nodes", nodeRoutes);
app.use("/reports", reportsRoutes);
app.use("/grid-inspection", gridInspection);
app.use("/subscribers", subscribersRoutes);
app.use("/resident", residentRoutes);
app.use("/users", usersAdminRoutes);

function profileFields(user, details = {}) {
  const role = user.role;
  const base = {
    name: user.display_name || user.username,
    username: user.username,
    email: user.email || null,
    role,
    account_created_at: user.created_at,
    last_login_at: user.last_login_at,
  };

  if (role === "admin") {
    return {
      ...base,
      permission_level: "Administrator",
      access_scope: user.assigned_zone || "All monitoring, grid, audit, and administration functions",
    };
  }
  if (role === "operator") {
    return {
      ...base,
      assigned_zone: user.assigned_zone || null,
      shift_contact: user.shift_contact || null,
    };
  }
  return {
    ...base,
    phone: details.phone || null,
    monitored_zone: details.monitored_zone || null,
    notification_preferences: user.notification_preferences || { sms: true, browser: true },
  };
}

app.get("/profile", authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT id, username, display_name, email, role, created_at,
              last_login_at, assigned_zone, shift_contact,
              notification_preferences
         FROM users
        WHERE id = $1`,
      [req.user.user_id],
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: "profile not found" });

    const user = userResult.rows[0];
    let details = {};
    if (user.role === "resident") {
      const subscriberResult = await pool.query(
        `SELECT s.phone, n.name AS monitored_zone
           FROM subscribers s
           LEFT JOIN nodes n ON n.node_id = s.node_id
          WHERE s.phone = $1 AND s.active = TRUE
          ORDER BY s.id
          LIMIT 1`,
        [user.username],
      );
      details = subscriberResult.rows[0] || {};
    }
    res.json(profileFields(user, details));
  } catch (err) {
    console.error("Profile lookup error", err);
    res.status(500).json({ error: "internal" });
  }
});

app.put("/profile", authMiddleware, async (req, res) => {
  const allowed = ["display_name", "email", "assigned_zone", "shift_contact", "notification_preferences"];
  const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "no editable profile fields supplied" });
  if (updates.notification_preferences !== undefined &&
      (typeof updates.notification_preferences !== "object" || Array.isArray(updates.notification_preferences))) {
    return res.status(400).json({ error: "notification_preferences must be an object" });
  }

  try {
    const assignments = [];
    const values = [];
    Object.entries(updates).forEach(([key, value], index) => {
      assignments.push(`${key} = $${index + 1}`);
      values.push(key === "notification_preferences" ? JSON.stringify(value) : value || null);
    });
    values.push(req.user.user_id);
    const result = await pool.query(
      `UPDATE users SET ${assignments.join(", ")} WHERE id = $${values.length}
       RETURNING id, username, display_name, email, role, created_at,
                 last_login_at, assigned_zone, shift_contact, notification_preferences`,
      values,
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "profile not found" });
    res.json(profileFields(result.rows[0]));
  } catch (err) {
    console.error("Profile update error", err);
    res.status(500).json({ error: "internal" });
  }
});

app.post("/login", express.json(), async (req, res) => {
  const { username, password } = req.body;
  const r = await pool.query("SELECT * FROM users WHERE username=$1", [
    username,
  ]);
  if (r.rows.length === 0)
    return res.status(401).json({ error: "invalid credentials" });

  const user = r.rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: "invalid credentials" });

  await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

  const token = jwt.sign(
    { user_id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: "2h" },
  );
  res.json({ token });
});

app.get(
  "/history",
  authMiddleware,
  requireAnyRole(["admin", "operator"]),
  async (req, res) => {
    const node = req.query.node;
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 500);
    if (!node) return res.status(400).json({ error: "node query required" });

    try {
      const q = `SELECT timestamp, water_level_cm FROM readings WHERE node_id = $1 ORDER BY timestamp DESC LIMIT $2`;
      const r = await pool.query(q, [node, limit]);
      res.json(r.rows);
    } catch (err) {
      console.error("History error", err);
      res.status(500).json({ error: "internal" });
    }
  },
);

// List nodes
// Note: Node CRUD operations are now in routes/nodes.js

app.post("/alert-events", authMiddleware, async (req, res) => {
  const { alert_id, event_type } = req.body;
  if (!alert_id || !event_type)
    return res.status(400).json({ error: "missing fields" });

  try {
    const q = `INSERT INTO alert_events (alert_id, event_type, user_agent, operator)
               VALUES ($1,$2,$3,$4) RETURNING *`;
    const vals = [
      alert_id,
      event_type,
      req.headers["user-agent"],
      req.user.username,
    ];
    const r = await pool.query(q, vals);
    res.json(r.rows[0]);
  } catch (err) {
    console.error("Alert event log error", err);
    res.status(500).json({ error: "internal" });
  }
});

app.get(
  "/reports/alerts-per-day",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const q = `SELECT date_trunc('day', triggered_at) AS day,
                    COUNT(*) FILTER (WHERE alert_level = 'CRITICAL') AS critical_count,
                    COUNT(*) FILTER (WHERE alert_level = 'WARNING') AS warning_count
             FROM alerts GROUP BY day ORDER BY day DESC LIMIT 30`;
    const r = await pool.query(q);
    res.json(r.rows);
  },
);

app.get(
  "/reports/events-per-day",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const q = `SELECT date_trunc('day', triggered_at) AS day,
                    COUNT(*) FILTER (WHERE event_type = 'notification') AS notifications,
                    COUNT(*) FILTER (WHERE event_type = 'sound') AS sounds
             FROM alert_events GROUP BY day ORDER BY day DESC LIMIT 30`;
    const r = await pool.query(q);
    res.json(r.rows);
  },
);

app.get(
  "/reports/response-time",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const q = `SELECT date_trunc('day', triggered_at) AS day,
                    AVG(EXTRACT(EPOCH FROM (acknowledged_at - triggered_at))) AS avg_response_seconds
             FROM alerts WHERE acknowledged = TRUE
             GROUP BY day ORDER BY day DESC LIMIT 30`;
    const r = await pool.query(q);
    res.json(r.rows);
  },
);

app.get(
  "/reports/alerts-per-day.csv",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const q = `SELECT date_trunc('day', triggered_at) AS day,
                    COUNT(*) FILTER (WHERE alert_level = 'CRITICAL') AS critical_count,
                    COUNT(*) FILTER (WHERE alert_level = 'WARNING') AS warning_count
             FROM alerts GROUP BY day ORDER BY day DESC LIMIT 30`;
    const r = await pool.query(q);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="alerts-per-day.csv"',
    );

    const header = "day,critical_count,warning_count\n";
    const rows = r.rows
      .map(
        (row) =>
          `${row.day.toISOString().split("T")[0]},${row.critical_count},${row.warning_count}`,
      )
      .join("\n");

    res.send(header + rows);
  },
);

app.get(
  "/reports/events-per-day.csv",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const q = `SELECT date_trunc('day', triggered_at) AS day,
                    COUNT(*) FILTER (WHERE event_type = 'notification') AS notifications,
                    COUNT(*) FILTER (WHERE event_type = 'sound') AS sounds
             FROM alert_events GROUP BY day ORDER BY day DESC LIMIT 30`;
    const r = await pool.query(q);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="events-per-day.csv"',
    );

    const header = "day,notifications,sounds\n";
    const rows = r.rows
      .map(
        (row) =>
          `${row.day.toISOString().split("T")[0]},${row.notifications},${row.sounds}`,
      )
      .join("\n");

    res.send(header + rows);
  },
);

app.get(
  "/reports/response-time.csv",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const q = `SELECT date_trunc('day', triggered_at) AS day,
                    AVG(EXTRACT(EPOCH FROM (acknowledged_at - triggered_at))) AS avg_response_seconds
             FROM alerts WHERE acknowledged = TRUE
             GROUP BY day ORDER BY day DESC LIMIT 30`;
    const r = await pool.query(q);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="response-time.csv"',
    );

    const header = "day,avg_response_seconds\n";
    const rows = r.rows
      .map(
        (row) =>
          `${row.day.toISOString().split("T")[0]},${row.avg_response_seconds}`,
      )
      .join("\n");

    res.send(header + rows);
  },
);

// MQTT client with reconnection
const mqttOptions = {
  username: MQTT_USER,
  password: MQTT_PASS,
  reconnectPeriod: 5000,
};
if (String(MQTT_TLS).toLowerCase() === "true") {
  if (!MQTT_CA_FILE || !fs.existsSync(MQTT_CA_FILE)) {
    console.error("FATAL: MQTT_TLS=true requires a readable MQTT_CA_FILE");
    process.exit(1);
  }
  mqttOptions.ca = fs.readFileSync(MQTT_CA_FILE);
  mqttOptions.rejectUnauthorized = true;
}
const client = mqtt.connect(mqttUrl, mqttOptions);

client.on("connect", () => {
  console.log("MQTT connected");
  client.subscribe(MQTT_TOPIC, { qos: 1 }, (err) => {
    if (err) console.error("Subscribe error", err);
  });
});

client.on("reconnect", () => console.log("MQTT reconnecting..."));
client.on("error", (err) => console.error("MQTT error", err));

// Helper: parse and validate payload
function parsePayload(msg) {
  try {
    const obj = JSON.parse(msg.toString());
    if (typeof obj.node_id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(obj.node_id))
      throw new Error("node_id must be a safe identifier");
    const timestampMs = typeof obj.timestamp === "string" ? Date.parse(obj.timestamp) : NaN;
    if (!Number.isFinite(timestampMs))
      throw new Error("timestamp must be a valid ISO date");
    if (timestampMs - Date.now() > 60 * 1000)
      throw new Error("timestamp is in the future");
    if (obj.water_level_cm !== null &&
        (typeof obj.water_level_cm !== "number" || !Number.isFinite(obj.water_level_cm)))
      throw new Error("water_level_cm must be finite or null");
    if (obj.water_level_cm !== null && (obj.water_level_cm < 0 || obj.water_level_cm > 1000))
      throw new Error("water_level_cm is out of range");
    if (obj.battery_v !== undefined && obj.battery_v !== null &&
        (typeof obj.battery_v !== "number" || !Number.isFinite(obj.battery_v) || obj.battery_v < 0 || obj.battery_v > 6))
      throw new Error("battery_v is out of range");
    if (!["NORMAL", "WARNING", "CRITICAL", "SENSOR_ERROR"].includes(obj.status))
      throw new Error("status is invalid");
    if (obj.status === "SENSOR_ERROR" && obj.water_level_cm !== null)
      throw new Error("sensor errors must not contain a water level");
    if (obj.status !== "SENSOR_ERROR" && typeof obj.water_level_cm !== "number")
      throw new Error("normal readings require a water level");
    return obj;
  } catch (e) {
    console.error("Payload parse error", e.message);
    return null;
  }
}

// Insert reading into DB
async function saveReading(payload, raw) {
  const q = `INSERT INTO readings (node_id, timestamp, water_level_cm, battery_v, status, raw_payload)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`;
  const vals = [
    payload.node_id,
    payload.timestamp,
    payload.water_level_cm,
    payload.battery_v ?? null,
    payload.status,
    raw,
  ];
  const res = await pool.query(q, vals);
  return res.rows[0].id;
}

// Insert alert record
async function saveAlert(node_id, level, waterLevelCm) {
  const q = `INSERT INTO alerts (
      node_id,
      alert_level,
      water_level_cm,
      sent,
      provider,
      provider_response )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id`;

  const values = [node_id, level, waterLevelCm, false, null, null];

  const result = await pool.query(q, values);

  return result.rows[0].id;
}

// Check cooldown
function isInCooldown(node_id, level) {
  const key = `${node_id}::${level}`;
  const ts = cooldownMap.get(key);
  if (!ts) return false;
  const now = Date.now();
  return now - ts < ALERT_COOLDOWN_SEC * 1000;
}
function setCooldown(node_id, level) {
  const key = `${node_id}::${level}`;
  cooldownMap.set(key, Date.now());
}

async function maybeTriggerGridHazard(payload) {
  try {
    const nodeId = payload.node_id;

    if (payload.status !== "CRITICAL") {
      return;
    }

    const query = `
      SELECT
        ge.*
      FROM grid_equipment ge
      JOIN nodes n
        ON n.node_id = $1
      WHERE
        ge.location IS NOT NULL
        AND n.lat IS NOT NULL
        AND n.lng IS NOT NULL
        AND ge.status = 'NORMAL'
        AND ST_DWithin(
          ge.location,
          ST_SetSRID(
            ST_MakePoint(n.lng, n.lat),
            4326
          )::geography,
          1000
        )
    `;

    const result = await pool.query(query, [nodeId]);

    for (const equipment of result.rows) {
      const updateResult = await pool.query(
        `
        UPDATE grid_equipment
        SET
          recommended = TRUE,
          status = 'CUTOFF_RECOMMENDED',
          recommended_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [equipment.id],
      );

      const recommended = updateResult.rows[0];

      const message =
        `Flood detected near ` +
        `${recommended.name}. ` +
        `Cutoff recommended.`;

      try {
        await logAudit(
          recommended.id,
          null,
          "AUTO_RECOMMEND_CUTOFF",
          `Automatic cutoff recommendation generated because ${nodeId} reached CRITICAL flood level.`,
          message,
        );
      } catch (auditError) {
        console.error("Automatic recommendation audit error", auditError);
      }

      broadcast({
        type: "grid_recommendation",
        message: `Flood detected near ${recommended.name}. Cutoff recommended.`,
        equipment: recommended,
        node_id: nodeId,
        severity: "CRITICAL",
        automatic: true,
      });
    }
  } catch (err) {
    console.error("Grid hazard detection error", err);
  }
}

// Send SMS via Twilio
async function sendSmsTwilio(to, body) {
  if (!twilioClient) throw new Error("Twilio not configured");
  const msg = await twilioClient.messages.create({
    from: TWILIO_FROM,
    to,
    body,
  });
  return msg;
}

// Send SMS via generic HTTP gateway (POST)
async function sendSmsHttp(to, body) {
  if (!SMS_GATEWAY_URL) throw new Error("HTTP SMS gateway not configured");
  const resp = await axios.post(
    SMS_GATEWAY_URL,
    {
      api_key: SMS_GATEWAY_APIKEY,
      from: SMS_GATEWAY_FROM,
      to,
      message: body,
    },
    { timeout: 10000 },
  );
  return resp.data;
}

async function sendSms(to, body) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return {
        provider: SMS_PROVIDER === "simulated" || SMS_PROVIDER === "mock" ? "simulated_sms" : SMS_PROVIDER,
        response: await smsProvider.send(to, body),
      };
    } catch (err) {
      lastError = err;
      const status = err.response?.status || err.status;
      const retryable = !status || status === 408 || status === 429 || status >= 500;
      console.error(`SMS attempt ${attempt}/3 failed for ${to}: ${err.message}`);
      if (!retryable || attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

// Compose alert message
function composeAlertMessage(node_id, level, levelValue, timestamp) {
  return `ALERT ${level} at ${node_id}: water level ${levelValue} cm at ${timestamp}. Avoid flooded areas and stay clear of electrical equipment.`;
}

// Main alert flow
async function handleAlert(payload) {
  const node = payload.node_id;
  const level = payload.status; // expecting "WARNING" or "CRITICAL"
  const levelValue = payload.water_level_cm;
  const ts = payload.timestamp;

  // Only send for WARNING or CRITICAL
  if (!["WARNING", "CRITICAL"].includes(level)) return;

  // Deduplicate / cooldown
  if (isInCooldown(node, level)) {
    console.log(`Cooldown active for ${node} ${level}, skipping SMS`);
    return;
  }

  // Lookup subscribers from database
  let recipients = [];
  try {
    const subQuery = `SELECT id, phone FROM subscribers WHERE node_id = $1 AND active = TRUE AND role IN ('operator', 'resident')`;
    const subResult = await pool.query(subQuery, [node]);
    recipients = subResult.rows;
  } catch (err) {
    console.error("Subscriber lookup error", err);
  }

  // If no subscribers found, log it but don't fail - alert is recorded in database
  if (recipients.length === 0) {
    console.log(
      `No active subscribers for node ${node}, but alert is recorded in database`,
    );
    // Optionally set a default operator phone here for testing
    // recipients = [process.env.DEFAULT_ALERT_PHONE];
  }

  const body = composeAlertMessage(node, level, levelValue, ts);

  const alertId = await saveAlert(node, level, levelValue);
  let sentCount = 0;
  let provider = null;
  let providerResp = null;
  for (const recipient of recipients) {
    let deliveryStatus = "FAILED";
    let response = null;
    try {
      const delivery = await sendSms(recipient.phone, body);
      provider = delivery.provider;
      response = delivery.response;
      deliveryStatus = "SENT";
      sentCount += 1;
      providerResp = response;
      console.log(`SMS sent to ${recipient.phone} via ${provider}`);
    } catch (err) {
      console.error("SMS send error", err.message);
      response = { error: err.message };
    }
    await pool.query(
      `INSERT INTO alert_recipients (alert_id, subscriber_id, status, delivery_provider, provider_response, sent_at, attempts, next_attempt_at, last_error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        alertId,
        recipient.id,
        deliveryStatus,
        provider,
        response,
        deliveryStatus === "SENT" ? new Date() : null,
        3,
        deliveryStatus === "SENT" ? null : new Date(Date.now() + 60000),
        deliveryStatus === "SENT" ? null : response?.error || "delivery failed",
      ],
    );
  }

  await pool.query(
    "UPDATE alerts SET sent=$1, provider=$2, provider_response=$3 WHERE id=$4",
    [sentCount > 0, provider, providerResp, alertId],
  );
  if (sentCount > 0) setCooldown(node, level);

  // Broadcast alert to dashboard
  broadcast({
    type: "alert",
    node: node,
    level: level,
    levelValue: levelValue,
    timestamp: ts,
    id: alertId,
  });
}

async function retryFailedDeliveries() {
  const result = await pool.query(`
    SELECT ar.id, ar.alert_id, ar.subscriber_id, ar.attempts,
           a.node_id, a.alert_level, a.water_level_cm, a.triggered_at,
           s.phone
      FROM alert_recipients ar
      JOIN alerts a ON a.id = ar.alert_id
      JOIN subscribers s ON s.id = ar.subscriber_id
     WHERE ar.status = 'FAILED'
       AND ar.attempts < 8
       AND (ar.next_attempt_at IS NULL OR ar.next_attempt_at <= NOW())
     ORDER BY ar.id
     LIMIT 50
  `);

  for (const delivery of result.rows) {
    const body = composeAlertMessage(
      delivery.node_id,
      delivery.alert_level,
      delivery.water_level_cm,
      delivery.triggered_at,
    );
    try {
      const sent = await sendSms(delivery.phone, body);
      await pool.query(
        `UPDATE alert_recipients
            SET status='SENT', delivery_provider=$1, provider_response=$2,
                sent_at=NOW(), attempts=attempts+1, next_attempt_at=NULL, last_error=NULL
          WHERE id=$3`,
        [sent.provider, sent.response, delivery.id],
      );
      await pool.query(
        `UPDATE alerts SET sent=TRUE, provider=$1, provider_response=$2 WHERE id=$3`,
        [sent.provider, sent.response, delivery.alert_id],
      );
      console.log(`Retried SMS delivery ${delivery.id} successfully`);
    } catch (err) {
      const nextAttempt = Math.min(delivery.attempts + 1, 8);
      const delayMs = Math.min(15 * 60 * 1000, 1000 * 2 ** nextAttempt);
      await pool.query(
        `UPDATE alert_recipients
            SET attempts=attempts+1, next_attempt_at=NOW() + ($1 * INTERVAL '1 second'), last_error=$2
          WHERE id=$3`,
        [Math.ceil(delayMs / 1000), err.message, delivery.id],
      );
      console.error(`SMS retry ${delivery.id} failed; next attempt scheduled`, err.message);
    }
  }
}

setInterval(() => {
  retryFailedDeliveries().catch((err) => console.error("SMS retry worker error", err));
}, 60000).unref();

// Server-side threshold evaluation (optional redundancy)
function serverEvaluateStatus(payload) {
  if (payload.status === "SENSOR_ERROR" || payload.water_level_cm === null) {
    return "SENSOR_ERROR";
  }
  const waterLevelCm = Number(payload.water_level_cm);
  const previous = nodeStatusMap.get(payload.node_id) || "NORMAL";

  let next = previous;
  if (previous === "CRITICAL") {
    if (waterLevelCm < Number(CRITICAL_LEVEL_CM) - 3)
      next = waterLevelCm < Number(WARNING_LEVEL_CM) - 3 ? "NORMAL" : "WARNING";
  } else if (previous === "WARNING") {
    if (waterLevelCm >= Number(CRITICAL_LEVEL_CM)) next = "CRITICAL";
    else if (waterLevelCm < Number(WARNING_LEVEL_CM) - 3) next = "NORMAL";
  } else if (waterLevelCm >= Number(CRITICAL_LEVEL_CM)) next = "CRITICAL";
  else if (waterLevelCm >= Number(WARNING_LEVEL_CM)) next = "WARNING";

  nodeStatusMap.set(payload.node_id, next);
  return next;
}

// MQTT message handler
client.on("message", async (topic, message) => {
  try {
    const payload = parsePayload(message);
    if (!payload) return;

    const nodeResult = await pool.query(
      "SELECT lat, lng FROM nodes WHERE node_id = $1",
      [payload.node_id],
    );
    if (nodeResult.rows.length === 0) {
      throw new Error(`Unknown sensor node ${payload.node_id}`);
    }

    payload.status = serverEvaluateStatus(payload);

    // Save reading
    await saveReading(payload, message.toString());

    // Enrich with coordinates
    try {
      payload.lat = nodeResult.rows[0].lat;
      payload.lng = nodeResult.rows[0].lng;
    } catch (err) {
      console.error("Node lookup error", err);
    }

    // Broadcast enriched reading to dashboard
    broadcast({ type: "reading", payload });

    // Handle alerts and hazard escalation
    if (payload.status === "WARNING" || payload.status === "CRITICAL") {
      await handleAlert(payload);
      await maybeTriggerGridHazard(payload);
    }
  } catch (err) {
    console.error("Processing error", err);
  }
});

// Start HTTP + WS server
server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
