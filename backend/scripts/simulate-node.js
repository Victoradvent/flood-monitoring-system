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
const fs = require("fs");
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
  MQTT_PORT = 8883,
  MQTT_TLS = "true",
  MQTT_CA_FILE = "/run/mqtt-certs/ca.crt",
  MQTT_SIM_USER,
  MQTT_SIM_PASS,
  MQTT_SIM_TOPIC = "nodes/flood/simulated",
} = process.env;

const tlsEnabled = String(MQTT_TLS).toLowerCase() === "true";
const options = {
  username: MQTT_SIM_USER,
  password: MQTT_SIM_PASS,
};
if (tlsEnabled) {
  if (!fs.existsSync(MQTT_CA_FILE)) {
    throw new Error(`SIMULATED TLS CA not found: ${MQTT_CA_FILE}`);
  }
  options.ca = fs.readFileSync(MQTT_CA_FILE);
  options.rejectUnauthorized = true;
}
const client = mqtt.connect(
  `${tlsEnabled ? "mqtts" : "mqtt"}://${MQTT_BROKER}:${MQTT_PORT}`,
  options,
);

function statusFor(levelCm) {
  if (levelCm >= 50) return "CRITICAL";
  if (levelCm >= 30) return "WARNING";
  return "NORMAL";
}

let readingsSent = 0;

client.on("connect", () => {
  console.log(`Simulating ${nodeIds.length} nodes on topic "${MQTT_SIM_TOPIC}"...`);

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
        simulated: true,
        timestamp: new Date().toISOString(),
        water_level_cm: levelCm,
        battery_v: 3.7 - (index % 4) * 0.1,
        status: statusFor(levelCm),
      };

      client.publish(MQTT_SIM_TOPIC, JSON.stringify(payload), { qos: 1 });
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
