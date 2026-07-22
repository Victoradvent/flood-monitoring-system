/*
  ESP32 Flood Node - Ready to Flash
  Features:
   - Ultrasonic sensor (JSN-SR04T) reading
   - Moving average filter
   - Multi-level threshold with hysteresis
   - MQTT publish with username/password auth
   - WiFi and MQTT reconnection with exponential backoff
   - NTP-based ISO timestamp
   - Simple SPIFFS buffering for unsent payloads
   - Placeholder for GSM fallback
  Dependencies:
   - PubSubClient
   - ArduinoJson
   - SPIFFS (built-in)
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "SPIFFS.h"
#include <time.h>

// ---------- CONFIG ----------
/* WiFi */
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

/* MQTT */
const char* MQTT_BROKER = "broker.example.com";
const uint16_t MQTT_PORT = 1883;
const char* MQTT_USER = "mqtt_user";
const char* MQTT_PASS = "mqtt_password";
const char* MQTT_TOPIC = "nodes/flood";
const char* NODE_ID = "NODE001";

/* Ultrasonic pins */
const int PIN_TRIG = 13;
const int PIN_ECHO = 12;

/* Battery monitor analog pin */
const int PIN_BATT = 35;

/* Sampling and thresholds (cm) */
const unsigned long SAMPLE_INTERVAL_MS = 10000; // 10s
const float WARNING_LEVEL_CM = 30.0;
const float CRITICAL_LEVEL_CM = 50.0;
const float HYSTERESIS_CM = 3.0;

/* Filtering */
const int FILTER_WINDOW = 5;

/* SPIFFS buffer file */
const char* BUFFER_FILE = "/unsent.jsonl";

// ---------- GLOBALS ----------
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

unsigned long lastSampleTime = 0;
float filterBuffer[FILTER_WINDOW];
int filterIndex = 0;
int filterCount = 0;

enum NodeStatus { OK, WARNING, CRITICAL };
NodeStatus currentStatus = OK;

// Reconnection backoff
unsigned long wifiBackoff = 1000;
unsigned long mqttBackoff = 1000;
const unsigned long MAX_BACKOFF = 60000;

// ---------- UTILITIES ----------

void initSPIFFS() {
  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS mount failed");
  }
}

void appendToBuffer(const char* line) {
  File f = SPIFFS.open(BUFFER_FILE, FILE_APPEND);
  if (!f) {
    Serial.println("Failed to open buffer file for append");
    return;
  }
  f.println(line);
  f.close();
}

void flushBuffer() {
  if (!SPIFFS.exists(BUFFER_FILE)) return;
  File f = SPIFFS.open(BUFFER_FILE, FILE_READ);
  if (!f) return;
  // Read all lines and attempt to publish
  while (f.available()) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) continue;
    if (mqttClient.connected()) {
      bool ok = mqttClient.publish(MQTT_TOPIC, line.c_str());
      if (!ok) {
        // stop trying further; keep remaining lines
        f.close();
        return;
      }
    } else {
      f.close();
      return;
    }
  }
  f.close();
  // If all published, remove file
  SPIFFS.remove(BUFFER_FILE);
}

/* NTP time */
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 3600 * 1; // adjust to your timezone (WAT = +1)
const int   daylightOffset_sec = 0;

String isoTimestamp() {
  time_t now;
  time(&now);
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  char buf[32];
  // Format: YYYY-MM-DDTHH:MM:SSZ (UTC)
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

/* WiFi connect with backoff */
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("Connecting to WiFi %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(200);
    if (millis() - start > 10000) break;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected");
    wifiBackoff = 1000; // reset backoff
    // init NTP
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  } else {
    Serial.println("WiFi connect failed, will retry with backoff");
    delay(wifiBackoff);
    wifiBackoff = min(wifiBackoff * 2, MAX_BACKOFF);
  }
}

/* MQTT connect with auth and backoff */
void connectMQTT() {
  if (mqttClient.connected()) return;
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  Serial.printf("Connecting to MQTT %s:%d\n", MQTT_BROKER, MQTT_PORT);
  unsigned long start = millis();
  while (!mqttClient.connected()) {
    if (mqttClient.connect(NODE_ID, MQTT_USER, MQTT_PASS)) {
      Serial.println("MQTT connected");
      mqttBackoff = 1000;
      // flush any buffered messages
      flushBuffer();
      break;
    } else {
      Serial.printf("MQTT connect failed, rc=%d. Backoff %lu ms\n", mqttClient.state(), mqttBackoff);
      delay(mqttBackoff);
      mqttBackoff = min(mqttBackoff * 2, MAX_BACKOFF);
      if (millis() - start > 30000) break;
    }
  }
}

/* Ultrasonic ping */
unsigned long pingUltrasonic() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  unsigned long duration = pulseIn(PIN_ECHO, HIGH, 30000); // 30ms timeout
  return duration;
}

float durationToCm(unsigned long durationUs) {
  if (durationUs == 0) return -1.0;
  return (durationUs / 29.1) / 2.0;
}

float readBatteryVoltage() {
  int raw = analogRead(PIN_BATT);
  float v = (raw / 4095.0) * 3.3 * 2.0; // adjust divider ratio if different
  return v;
}

float filteredReading(float newVal) {
  filterBuffer[filterIndex] = newVal;
  filterIndex = (filterIndex + 1) % FILTER_WINDOW;
  if (filterCount < FILTER_WINDOW) filterCount++;
  float sum = 0;
  for (int i = 0; i < filterCount; ++i) sum += filterBuffer[i];
  return sum / filterCount;
}

NodeStatus evaluateStatus(float levelCm) {
  if (currentStatus == CRITICAL) {
    if (levelCm < (CRITICAL_LEVEL_CM - HYSTERESIS_CM)) {
      if (levelCm < (WARNING_LEVEL_CM - HYSTERESIS_CM)) return OK;
      return WARNING;
    }
    return CRITICAL;
  }
  if (currentStatus == WARNING) {
    if (levelCm >= CRITICAL_LEVEL_CM) return CRITICAL;
    if (levelCm < (WARNING_LEVEL_CM - HYSTERESIS_CM)) return OK;
    return WARNING;
  }
  // OK
  if (levelCm >= CRITICAL_LEVEL_CM) return CRITICAL;
  if (levelCm >= WARNING_LEVEL_CM) return WARNING;
  return OK;
}

void publishReading(float levelCm, float battV, NodeStatus status) {
  StaticJsonDocument<256> doc;
  doc["node_id"] = NODE_ID;
  doc["timestamp"] = isoTimestamp();
  doc["water_level_cm"] = levelCm;
  doc["battery_v"] = battV;
  switch (status) {
    case OK: doc["status"] = "OK"; break;
    case WARNING: doc["status"] = "WARNING"; break;
    case CRITICAL: doc["status"] = "CRITICAL"; break;
  }
  char payload[512];
  size_t n = serializeJson(doc, payload, sizeof(payload));

  if (mqttClient.connected()) {
    bool ok = mqttClient.publish(MQTT_TOPIC, payload, n);
    if (!ok) {
      Serial.println("MQTT publish failed, buffering");
      appendToBuffer(payload);
    } else {
      Serial.println("Published payload:");
      Serial.println(payload);
    }
  } else {
    Serial.println("MQTT not connected, buffering payload");
    appendToBuffer(payload);
  }
}

/* Placeholder GSM fallback - implement SIM800L AT sequence here */
void gsmFallbackSend(const char* payload) {
  // Implement GSM POST or SMS via SIM800L
  // Example: send SMS to gateway number with payload summary
}

// ---------- SETUP ----------
void setup() {
  Serial.begin(115200);
  delay(100);

  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_BATT, INPUT);

  // initialize filter buffer
  for (int i = 0; i < FILTER_WINDOW; ++i) filterBuffer[i] = 0.0;

  initSPIFFS();

  connectWiFi();
  connectMQTT();
}

// ---------- LOOP ----------
void loop() {
  // Ensure WiFi
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // Ensure MQTT
  if (!mqttClient.connected()) {
    connectMQTT();
  } else {
    mqttClient.loop();
  }

  unsigned long now = millis();
  if (now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
    lastSampleTime = now;

    unsigned long dur = pingUltrasonic();
    float levelCm = durationToCm(dur);
    if (levelCm < 0) {
      Serial.println("Ultrasonic timeout");
      continue;
    }

    float filtered = filteredReading(levelCm);
    float batt = readBatteryVoltage();

    NodeStatus newStatus = evaluateStatus(filtered);
    if (newStatus != currentStatus) {
      Serial.printf("Status changed %d -> %d\n", currentStatus, newStatus);
      currentStatus = newStatus;
      // Optionally: immediate publish and backend will trigger SMS
    }

    publishReading(filtered, batt, currentStatus);

    // If MQTT disconnected and GSM available, you can call gsmFallbackSend
    // Example: if (!mqttClient.connected()) gsmFallbackSend(payload);

    // Try to flush buffered messages if connected
    if (mqttClient.connected()) flushBuffer();
  }

  delay(10);
}
