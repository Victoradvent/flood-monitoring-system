// src/mqttClient.js
import mqtt from "mqtt";

const WS_URL = process.env.REACT_APP_MQTT_WS_URL || "ws://localhost:9001";
const MQTT_TOPIC = process.env.REACT_APP_MQTT_TOPIC || "nodes/flood";
const MQTT_USER = process.env.REACT_APP_MQTT_USER || "";
const MQTT_PASS = process.env.REACT_APP_MQTT_PASS || "";

let client = null;
const listeners = new Set();

function connect() {
  if (client && client.connected) return client;

  const opts = {
    username: MQTT_USER || undefined,
    password: MQTT_PASS || undefined,
    reconnectPeriod: 3000,
    connectTimeout: 30 * 1000,
  };

  client = mqtt.connect(WS_URL, opts);

  client.on("connect", () => {
    console.log("MQTT over WS connected", WS_URL);
    client.subscribe(MQTT_TOPIC, { qos: 1 }, (err) => {
      if (err) console.error("Subscribe error", err);
    });
  });

  client.on("reconnect", () => console.log("MQTT reconnecting"));
  client.on("error", (err) => console.error("MQTT error", err));
  client.on("close", () => console.log("MQTT closed"));

  client.on("message", (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      const msg = { type: "reading", payload };
      listeners.forEach((cb) => cb(msg));
    } catch (err) {
      console.error("Invalid MQTT message", err);
    }
  });

  return client;
}

export function subscribe(cb) {
  listeners.add(cb);
  connect();
  return () => listeners.delete(cb);
}

export function publish(topic, obj) {
  if (!client || !client.connected) return false;
  client.publish(topic, JSON.stringify(obj));
  return true;
}
