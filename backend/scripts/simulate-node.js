// Simulates an ESP32 flood node publishing readings over MQTT, so you can see
// the dashboard update live without flashing real hardware. Matches the exact
// payload shape firmware/node.ino sends (see its buildPayload section).
//
// Usage (from the backend container, since it already has the `mqtt` package
// and the same MQTT credentials as the real broker):
//   docker compose exec backend node scripts/simulate-node.js --nodes=12 --readings=12 --interval=15000
//
// It ramps water level up past WARNING (30cm) and CRITICAL (50cm), then back
// down, publishing one reading every 15 seconds by default. Ctrl+C to stop.

require("dotenv").config();
const mqtt = require("mqtt");

const nodeArgument = process.argv.find((argument) =>
  argument.startsWith("--nodes="),
);
const readingsArgument = process.argv.find((argument) =>
  argument.startsWith("--readings="),
);
const intervalArgument = process.argv.find((argument) =>
  argument.startsWith("--interval="),
);
const nodeIds = nodeArgument
  ? Array.from(
      { length: Number(nodeArgument.split("=")[1]) || 1 },
      (_, index) => `NODE${String(index + 1).padStart(3, "0")}`,
    )
  : [process.argv[2] || "NODE001"];
const maxReadings =
  Number(readingsArgument?.split("=")[1]) || Number(process.argv[3]) || 0;
const intervalMs = Math.max(
  Number(intervalArgument?.split("=")[1]) || 15000,
  1000,
);
const {
  MQTT_BROKER = "mqtt",
  MQTT_PORT = 1883,
  MQTT_USER,
  MQTT_PASS,
  MQTT_TOPIC = "nodes/flood",
} = process.env;

const client = mqtt.connect(`mqtt://${MQTT_BROKER}:${MQTT_PORT}`, {
  username: MQTT_USER,
  password: MQTT_PASS,
});

function statusFor(levelCm) {
  if (levelCm >= 50) return "CRITICAL";
  if (levelCm >= 30) return "WARNING";
  return "NORMAL";
}

let readingsSent = 0;

client.on("connect", () => {
  console.log(`Simulating ${nodeIds.length} nodes on topic "${MQTT_TOPIC}"...`);

  const interval = setInterval(() => {
    nodeIds.forEach((nodeId, index) => {
      const phase = (readingsSent + index * 3) % 12;
      const levelCm =
        phase < 4
          ? 15 + phase * 3
          : phase < 8
            ? 30 + phase * 3
            : 50 + (phase - 8) * 5;
      const payload = {
        node_id: nodeId,
        timestamp: new Date().toISOString(),
        water_level_cm: levelCm,
        battery_v: 3.7 - (index % 4) * 0.1,
        status: statusFor(levelCm),
      };

      client.publish(MQTT_TOPIC, JSON.stringify(payload), { qos: 1 });
      console.log("Published:", payload);
    });

    readingsSent += 1;
    if (maxReadings > 0 && readingsSent >= maxReadings) {
      clearInterval(interval);
      client.end();
    }
  }, intervalMs);
});

client.on("error", (err) => console.error("MQTT error", err.message));
