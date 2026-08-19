// Simulates an ESP32 flood node publishing readings over MQTT, so you can see
// the dashboard update live without flashing real hardware. Matches the exact
// payload shape firmware/node.ino sends (see its buildPayload section).
//
// Usage (from the backend container, since it already has the `mqtt` package
// and the same MQTT credentials as the real broker):
//   docker compose exec backend node scripts/simulate-node.js NODE001
//
// It ramps water level up past WARNING (30cm) and CRITICAL (50cm), then back
// down, publishing one reading every 5 seconds. Ctrl+C to stop.

require('dotenv').config();
const mqtt = require('mqtt');

const nodeId = process.argv[2] || 'NODE001';
const { MQTT_BROKER = 'mqtt', MQTT_PORT = 1883, MQTT_USER, MQTT_PASS, MQTT_TOPIC = 'nodes/flood' } = process.env;

const client = mqtt.connect(`mqtt://${MQTT_BROKER}:${MQTT_PORT}`, {
  username: MQTT_USER,
  password: MQTT_PASS
});

function statusFor(levelCm) {
  if (levelCm >= 50) return 'CRITICAL';
  if (levelCm >= 30) return 'WARNING';
  return 'NORMAL';
}

let levelCm = 5;
let direction = 1; // rising, then falls back once it peaks past CRITICAL

client.on('connect', () => {
  console.log(`Simulating ${nodeId} on topic "${MQTT_TOPIC}"...`);

  setInterval(() => {
    levelCm += direction * 5;
    if (levelCm >= 65) direction = -1;
    if (levelCm <= 5) direction = 1;

    const payload = {
      node_id: nodeId,
      timestamp: new Date().toISOString(),
      water_level_cm: levelCm,
      battery_v: 3.7,
      status: statusFor(levelCm)
    };

    client.publish(MQTT_TOPIC, JSON.stringify(payload), { qos: 1 });
    console.log('Published:', payload);
  }, 5000);
});

client.on('error', err => console.error('MQTT error', err.message));
