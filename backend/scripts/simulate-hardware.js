// SIMULATED HARDWARE - replace this process with firmware/node.ino on deployment.
// This uses the same MQTT topic and JSON contract as the ESP32 firmware.
// It models sensor noise/failures and a SIM800L-like intermittent transport.

require("dotenv").config();
const fs = require("fs");
const mqtt = require("mqtt");

const argument = (name, fallback) => {
  const value = process.argv.find((item) => item.startsWith(`--${name}=`));
  return value ? value.slice(name.length + 3) : fallback;
};
const nodes = Number(argument("nodes", 1));
const maxReadings = Number(argument("readings", 0));
const intervalMs = Math.max(250, Number(argument("interval", 1000)));
const invalidEvery = Math.max(0, Number(argument("invalid-every", process.env.SIM_SENSOR_INVALID_EVERY || 11)));
const signalLossEvery = Math.max(0, Number(argument("signal-loss-every", process.env.SIM_GSM_SIGNAL_LOSS_EVERY || 17)));
const seed = Number(argument("seed", process.env.SIM_SEED || 42));
const nodeIds = Array.from({ length: nodes }, (_, index) => `NODE${String(index + 1).padStart(3, "0")}`);
const broker = process.env.MQTT_BROKER || "mqtt";
const port = Number(process.env.MQTT_PORT || 1883);
const topic = process.env.MQTT_TOPIC || "nodes/flood";
const tlsEnabled = String(process.env.MQTT_TLS || "false").toLowerCase() === "true";
const options = {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
  reconnectPeriod: 2000,
};
if (tlsEnabled) {
  const caFile = process.env.MQTT_CA_FILE || "/run/mqtt-certs/ca.crt";
  if (!fs.existsSync(caFile)) throw new Error(`SIMULATED TLS CA not found: ${caFile}`);
  options.ca = fs.readFileSync(caFile);
  options.rejectUnauthorized = true;
}

class SimulatedGsm {
  constructor() {
    this.signal = 4;
    this.connected = false;
    this.randomState = seed >>> 0;
  }

  random() {
    this.randomState = (1664525 * this.randomState + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  connect() {
    this.signal = Math.max(0, Math.min(4, Math.round(this.random() * 4)));
    this.connected = this.signal >= 2;
    console.log(`[SIMULATED_GSM] connect signal=${this.signal}/4 connected=${this.connected}`);
    return this.connected;
  }

  canTransmit(sequence) {
    if (signalLossEvery > 0 && sequence > 0 && sequence % signalLossEvery === 0) {
      this.signal = 0;
      this.connected = false;
      console.warn(`[SIMULATED_GSM] intermittent signal loss at sequence=${sequence}`);
      return false;
    }
    if (!this.connected) return this.connect();
    this.signal = Math.max(0, Math.min(4, this.signal + (this.random() > 0.7 ? -1 : this.random() > 0.5 ? 1 : 0)));
    if (this.signal < 2) {
      this.connected = false;
      console.warn(`[SIMULATED_GSM] weak signal=${this.signal}/4; transmission deferred`);
      return false;
    }
    return true;
  }
}

class SimulatedUltrasonic {
  constructor() {
    this.randomState = (seed + 7) >>> 0;
  }

  random() {
    this.randomState = (1664525 * this.randomState + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  read(sequence, nodeIndex) {
    if (invalidEvery > 0 && sequence > 0 && sequence % invalidEvery === 0) {
      return { status: "SENSOR_ERROR", water_level_cm: null, error_code: "ULTRASONIC_TIMEOUT" };
    }
    const phase = (sequence + nodeIndex * 3) % 24;
    const trend = phase < 8 ? 15 + phase * 2.5 : phase < 16 ? 35 + (phase - 8) * 2.5 : 55 - (phase - 16) * 3;
    const noise = (this.random() - 0.5) * 2.4;
    const level = Math.max(0, Math.min(100, Number((trend + noise).toFixed(2))));
    const status = level >= 50 ? "CRITICAL" : level >= 30 ? "WARNING" : "NORMAL";
    return { status, water_level_cm: level };
  }
}

const sensor = new SimulatedUltrasonic();
const gsm = new SimulatedGsm();
const client = mqtt.connect(`${tlsEnabled ? "mqtts" : "mqtt"}://${broker}:${port}`, options);
let sequence = 0;
const pendingPayloads = [];

function finishSimulation() {
  let attempts = 0;
  const drain = () => {
    attempts += 1;
    if (!gsm.connected) gsm.connect();
    while (pendingPayloads.length > 0 && gsm.connected) publishPayload(pendingPayloads.shift());
    if (pendingPayloads.length === 0 || attempts >= 20) {
      if (pendingPayloads.length > 0) console.error(`[SIMULATED_ESP32] shutdown with ${pendingPayloads.length} buffered payloads`);
      setTimeout(() => client.end(), 500);
      return;
    }
    setTimeout(drain, 250);
  };
  drain();
}

function publishPayload(payload) {
  client.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
    if (error) console.error(`[SIMULATED_ESP32] publish failed sequence=${payload.sequence}`, error.message);
    else console.log(`[SIMULATED_ESP32] published node=${payload.node_id} sequence=${payload.sequence} status=${payload.status} level=${payload.water_level_cm}`);
  });
}

client.on("connect", () => {
  console.log(`[SIMULATED_ESP32] connected broker=${broker}:${port} tls=${tlsEnabled} topic=${topic}`);
  gsm.connect();
  const timer = setInterval(() => {
    sequence += 1;
    nodeIds.forEach((nodeId, index) => {
      const reading = sensor.read(sequence, index);
      const payload = {
        node_id: nodeId,
        timestamp: new Date().toISOString(),
        sequence,
        battery_v: Number((3.65 - (index % 4) * 0.08).toFixed(2)),
        ...reading,
      };
      if (!gsm.canTransmit(sequence)) {
        pendingPayloads.push(payload);
        console.warn(`[SIMULATED_ESP32] buffered sequence=${sequence} node=${nodeId} status=${reading.status}`);
        return;
      }
      while (pendingPayloads.length > 0 && gsm.connected) publishPayload(pendingPayloads.shift());
      publishPayload(payload);
    });
    if (maxReadings > 0 && sequence >= maxReadings) {
      clearInterval(timer);
      finishSimulation();
    }
  }, intervalMs);
});

client.on("reconnect", () => console.warn("[SIMULATED_ESP32] MQTT reconnecting"));
client.on("error", (error) => console.error("[SIMULATED_ESP32] MQTT error", error.message));
