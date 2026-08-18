// app.js - Node.js MQTT subscriber + alert handler
require('dotenv').config();
const mqtt = require('mqtt');
const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const Twilio = require('twilio');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');

 authMiddleware,
  requireAnyRole(['admin', 'operator']), 
  const {authenticateToken, authMiddleware, requireRole, requireAnyRole} = require('./auth');

// Shared modules
const pool = require('./db');
const { authenticateToken, authMiddleware, requireRole } = require('./auth');

// Route modules
const gridControl = require('./routes/grid-control');
const auditRoutes = require('./routes/audit');
const auditSummary = require('./routes/audit-summary');
const auditTrends = require('./routes/audit-trends');
const alertRoutes = require('./routes/alerts');
const nodeRoutes = require('./routes/nodes');
const reportsRoutes = require('./routes/reports');
const gridInspection = require('./routes/grid-inspection');
const subscribersRoutes = require('./routes/subscribers-admin');

// Config
const {
  MQTT_BROKER, MQTT_PORT, MQTT_USER, MQTT_PASS, MQTT_TOPIC,
  PG_HOST, PG_PORT, PG_USER, PG_PASS, PG_DB,
  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM,
  SMS_GATEWAY_URL, SMS_GATEWAY_APIKEY, SMS_GATEWAY_FROM,
  ALERT_COOLDOWN_SEC = 900, PORT = 3000
} = process.env;

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}
const mqttUrl = `mqtt://${MQTT_BROKER}:${MQTT_PORT}`;

// Twilio client (if configured)
const twilioClient = (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN)
  ? new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  : null;

// In-memory cooldown map: { "<node_id>::<level>": timestamp }
const cooldownMap = new Map();

// WebSocket server for dashboard
const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });
app.set('wss', wss);
app.use(cors());
app.use(express.json());

// Broadcast helper
function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// Simple health endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Mount all routes
app.use('/grid', gridControl);
app.use('/audit', auditRoutes);
app.use('/audit-summary', auditSummary);
app.use('/audit-trends', auditTrends);
app.use('/alerts', alertRoutes);
app.use('/nodes', nodeRoutes);
app.use('/reports', reportsRoutes);
app.use('/grid-inspection', gridInspection);
app.use('/subscribers', subscribersRoutes);

app.post('/login', express.json(), async (req, res) => {
  const { username, password } = req.body;
  const r = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
  if (r.rows.length === 0) return res.status(401).json({ error: 'invalid credentials' });

  const user = r.rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'invalid credentials' });

  const token = jwt.sign(
    { user_id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: '2h' }
  );
  res.json({ token });
});

app.get('/history', authMiddleware, requireAnyRole(['admin', 'operator']), async (req, res) => {
  const node = req.query.node;
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  if (!node) return res.status(400).json({ error: 'node query required' });

  try {
    const q = `SELECT timestamp, water_level_cm FROM readings WHERE node_id = $1 ORDER BY timestamp DESC LIMIT $2`;
    const r = await pool.query(q, [node, limit]);
    res.json(r.rows);
  } catch (err) {
    console.error('History error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// List nodes
// Note: Node CRUD operations are now in routes/nodes.js

app.post('/alert-events', authMiddleware, async (req, res) => {
  const { alert_id, event_type } = req.body;
  if (!alert_id || !event_type) return res.status(400).json({ error: 'missing fields' });

  try {
    const q = `INSERT INTO alert_events (alert_id, event_type, user_agent, operator)
               VALUES ($1,$2,$3,$4) RETURNING *`;
    const vals = [alert_id, event_type, req.headers['user-agent'], req.user.username];
    const r = await pool.query(q, vals);
    res.json(r.rows[0]);
  } catch (err) {
    console.error('Alert event log error', err);
    res.status(500).json({ error: 'internal' });
  }
});

app.get('/reports/alerts-per-day',  authMiddleware, requireRole('admin'), async (req, res) => {
  const q = `SELECT date_trunc('day', triggered_at) AS day,
                    COUNT(*) FILTER (WHERE alert_level = 'CRITICAL') AS critical_count,
                    COUNT(*) FILTER (WHERE alert_level = 'WARNING') AS warning_count
             FROM alerts GROUP BY day ORDER BY day DESC LIMIT 30`;
  const r = await pool.query(q);
  res.json(r.rows);
});

app.get('/reports/events-per-day',  authMiddleware, requireRole('admin'), async (req, res) => {
  const q = `SELECT date_trunc('day', triggered_at) AS day,
                    COUNT(*) FILTER (WHERE event_type = 'notification') AS notifications,
                    COUNT(*) FILTER (WHERE event_type = 'sound') AS sounds
             FROM alert_events GROUP BY day ORDER BY day DESC LIMIT 30`;
  const r = await pool.query(q);
  res.json(r.rows);
});

app.get('/reports/response-time',  authMiddleware, requireRole('admin'), async (req, res) => {
  const q = `SELECT date_trunc('day', triggered_at) AS day,
                    AVG(EXTRACT(EPOCH FROM (acknowledged_at - triggered_at))) AS avg_response_seconds
             FROM alerts WHERE acknowledged = TRUE
             GROUP BY day ORDER BY day DESC LIMIT 30`;
  const r = await pool.query(q);
  res.json(r.rows);
});

app.get('/reports/alerts-per-day.csv',  authMiddleware, requireRole('admin'), async (req, res) => {
  const q = `SELECT date_trunc('day', triggered_at) AS day,
                    COUNT(*) FILTER (WHERE alert_level = 'CRITICAL') AS critical_count,
                    COUNT(*) FILTER (WHERE alert_level = 'WARNING') AS warning_count
             FROM alerts GROUP BY day ORDER BY day DESC LIMIT 30`;
  const r = await pool.query(q);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="alerts-per-day.csv"');

  const header = 'day,critical_count,warning_count\n';
  const rows = r.rows.map(row => `${row.day.toISOString().split('T')[0]},${row.critical_count},${row.warning_count}`).join('\n');

  res.send(header + rows);
});

app.get('/reports/events-per-day.csv',  authMiddleware, requireRole('admin'), async (req, res) => {
  const q = `SELECT date_trunc('day', triggered_at) AS day,
                    COUNT(*) FILTER (WHERE event_type = 'notification') AS notifications,
                    COUNT(*) FILTER (WHERE event_type = 'sound') AS sounds
             FROM alert_events GROUP BY day ORDER BY day DESC LIMIT 30`;
  const r = await pool.query(q);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="events-per-day.csv"');

  const header = 'day,notifications,sounds\n';
  const rows = r.rows.map(row => `${row.day.toISOString().split('T')[0]},${row.notifications},${row.sounds}`).join('\n');

  res.send(header + rows);
});

app.get('/reports/response-time.csv',  authMiddleware, requireRole('admin'), async (req, res) => {
  const q = `SELECT date_trunc('day', triggered_at) AS day,
                    AVG(EXTRACT(EPOCH FROM (acknowledged_at - triggered_at))) AS avg_response_seconds
             FROM alerts WHERE acknowledged = TRUE
             GROUP BY day ORDER BY day DESC LIMIT 30`;
  const r = await pool.query(q);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="response-time.csv"');

  const header = 'day,avg_response_seconds\n';
  const rows = r.rows.map(row => `${row.day.toISOString().split('T')[0]},${row.avg_response_seconds}`).join('\n');

  res.send(header + rows);
});

// MQTT client with reconnection
const mqttOptions = {
  username: MQTT_USER,
  password: MQTT_PASS,
  reconnectPeriod: 5000
};
const client = mqtt.connect(mqttUrl, mqttOptions);

client.on('connect', () => {
  console.log('MQTT connected');
  client.subscribe(MQTT_TOPIC, { qos: 1 }, (err) => {
    if (err) console.error('Subscribe error', err);
  });
});

client.on('reconnect', () => console.log('MQTT reconnecting...'));
client.on('error', (err) => console.error('MQTT error', err));

// Helper: parse and validate payload
function parsePayload(msg) {
  try {
    const obj = JSON.parse(msg.toString());
    // expected fields: node_id, timestamp, water_level_cm, battery_v, status
    if (!obj.node_id || !obj.timestamp || typeof obj.water_level_cm !== 'number') {
      throw new Error('Invalid payload');
    }
    return obj;
  } catch (e) {
    console.error('Payload parse error', e.message);
    return null;
  }
}

// Insert reading into DB
async function saveReading(payload, raw) {
  const q = `INSERT INTO readings (node_id, timestamp, water_level_cm, battery_v, status, raw_payload)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`;
  const vals = [payload.node_id, payload.timestamp, payload.water_level_cm, payload.battery_v || null, payload.status || 'OK', raw];
  const res = await pool.query(q, vals);
  return res.rows[0].id;
}

// Insert alert record
async function saveAlert(node_id, level) {
  const q = `INSERT INTO alerts (node_id, alert_level, sent, provider, provider_response)
             VALUES ($1,$2,$3,$4,$5) RETURNING id`;
  const vals = [node_id, level, false, null, null];
  const res = await pool.query(q, vals);
  return res.rows[0].id;
}

// Check cooldown
function isInCooldown(node_id, level) {
  const key = `${node_id}::${level}`;
  const ts = cooldownMap.get(key);
  if (!ts) return false;
  const now = Date.now();
  return (now - ts) < (ALERT_COOLDOWN_SEC * 1000);
}
function setCooldown(node_id, level) {
  const key = `${node_id}::${level}`;
  cooldownMap.set(key, Date.now());
}

async function maybeTriggerGridHazard(payload) {
  try {
    const nodeId = payload.node_id;
    const level = payload.status || 'CRITICAL';
    if (level !== 'CRITICAL') return;

    const q = `SELECT ge.*
               FROM grid_equipment ge
               LEFT JOIN nodes n ON n.node_id = $1
               WHERE ge.location IS NOT NULL
                 AND n.lat IS NOT NULL
                 AND n.lng IS NOT NULL
                 AND ST_DWithin(
                   ge.location,
                   ST_SetSRID(ST_MakePoint(n.lng, n.lat), 4326)::geography,
                   1000
                 )
               AND ge.status = 'NORMAL' `;
    const r = await pool.query(q, [nodeId]);

    if (r.rowCount === 0) return;

    const equipment = r.rows[0];
    const updateRes = await pool.query(
      'UPDATE grid_equipment SET recommended=$1 WHERE id=$2 RETURNING *',
      [true, equipment.id]
    );
    const recommendedEquipment = updateRes.rows[0];
    const message = `Flood detected near ${recommendedEquipment.name}. Cutoff recommended.`;

    broadcast({
      type: 'grid_recommendation',
      message,
      equipment: recommendedEquipment,
      node_id: nodeId,
      severity: level
    });
  } catch (err) {
    console.error('Grid hazard detection error', err);
  }
}

// Send SMS via Twilio
async function sendSmsTwilio(to, body) {
  if (!twilioClient) throw new Error('Twilio not configured');
  const msg = await twilioClient.messages.create({ from: TWILIO_FROM, to, body });
  return msg;
}

// Send SMS via generic HTTP gateway (POST)
async function sendSmsHttp(to, body) {
  if (!SMS_GATEWAY_URL) throw new Error('HTTP SMS gateway not configured');
  const resp = await axios.post(SMS_GATEWAY_URL, {
    api_key: SMS_GATEWAY_APIKEY,
    from: SMS_GATEWAY_FROM,
    to,
    message: body
  }, { timeout: 10000 });
  return resp.data;
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
  if (!['WARNING', 'CRITICAL'].includes(level)) return;

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
    console.error('Subscriber lookup error', err);
  }

  // If no subscribers found, log it but don't fail - alert is recorded in database
  if (recipients.length === 0) {
    console.log(`No active subscribers for node ${node}, but alert is recorded in database`);
    // Optionally set a default operator phone here for testing
    // recipients = [process.env.DEFAULT_ALERT_PHONE];
  }

  const body = composeAlertMessage(node, level, levelValue, ts);

  const alertId = await saveAlert(node, level);
  let sentCount = 0;
  let provider = null;
  let providerResp = null;
  for (const recipient of recipients) {
    let deliveryStatus = 'FAILED';
    let response = null;
    try {
      if (twilioClient) {
        const resp = await sendSmsTwilio(recipient.phone, body);
        provider = 'twilio';
        response = resp;
      } else {
        const resp = await sendSmsHttp(recipient.phone, body);
        provider = 'http_gateway';
        response = resp;
      }
      deliveryStatus = 'SENT';
      sentCount += 1;
      providerResp = response;
      console.log(`SMS sent to ${recipient.phone} via ${provider}`);
    } catch (err) {
      console.error('SMS send error', err.message);
      response = { error: err.message };
    }
    await pool.query(
      `INSERT INTO alert_recipients (alert_id, subscriber_id, status, delivery_provider, provider_response, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [alertId, recipient.id, deliveryStatus, provider, response, deliveryStatus === 'SENT' ? new Date() : null]
    );
  }

  await pool.query(
    'UPDATE alerts SET sent=$1, provider=$2, provider_response=$3 WHERE id=$4',
    [sentCount > 0, provider, providerResp, alertId]
  );
  setCooldown(node, level);

  // Broadcast alert to dashboard
  broadcast({
    type: 'alert',
    node: node,
    level: level,
    levelValue: levelValue,
    timestamp: ts,
    id: alertId
  });
}

// Server-side threshold evaluation (optional redundancy)
function serverEvaluateStatus(payload, warningLevel = 30.0, criticalLevel = 50.0, hysteresis = 3.0) {
  // Use payload.status if provided; otherwise compute
  if (payload.status && ['OK','WARNING','CRITICAL'].includes(payload.status)) return payload.status;
  const v = payload.water_level_cm;
  if (v >= criticalLevel) return 'CRITICAL';
  if (v >= warningLevel) return 'WARNING';
  return 'OK';
}

// MQTT message handler
client.on('message', async (topic, message) => {
  try {
    const payload = parsePayload(message);
    if (!payload) return;

    // server-side status evaluation (redundant safety)
    payload.status = serverEvaluateStatus(payload);

    // Save reading
    await saveReading(payload, message.toString());

    // Enrich with coordinates
    try {
      const q = 'SELECT lat, lng FROM nodes WHERE node_id = $1';
      const r = await pool.query(q, [payload.node_id]);
      if (r.rows.length > 0) {
        payload.lat = r.rows[0].lat;
        payload.lng = r.rows[0].lng;
      }
    } catch (err) {
      console.error('Node lookup error', err);
    }

    // Broadcast enriched reading to dashboard
    broadcast({ type: 'reading', payload });

    // Handle alerts and hazard escalation
    if (payload.status === 'WARNING' || payload.status === 'CRITICAL') {
      await handleAlert(payload);
      await maybeTriggerGridHazard(payload);
    }
  } catch (err) {
    console.error('Processing error', err);
  }
});

// Start HTTP + WS server
server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
