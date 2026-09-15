const mqtt = require("mqtt");

const client = mqtt.connect(process.env.MQTT_BROKER_URL || "mqtt://mqtt:1883");

client.on("connect", () => {
  console.log("MQTT connected");
  client.subscribe("flood/alerts");
});

client.on("message", (topic, message) => {
  console.log(`Received message on ${topic}: ${message.toString()}`);
});

module.exports = client;
