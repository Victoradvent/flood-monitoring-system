const VALID_STATUSES = new Set([
  "NORMAL",
  "WARNING",
  "CRITICAL",
  "SENSOR_ERROR",
]);

function areValidThresholds(thresholds) {
  return (
    Number.isFinite(thresholds?.warning_cm) &&
    Number.isFinite(thresholds?.critical_cm) &&
    thresholds.warning_cm >= 0 &&
    thresholds.critical_cm > thresholds.warning_cm &&
    thresholds.critical_cm <= 1000
  );
}

function isFreshReading(timestamp, now = Date.now(), maxAgeMs = 30000) {
  const timestampMs = new Date(timestamp).getTime();
  return (
    Number.isFinite(timestampMs) &&
    timestampMs <= now &&
    now - timestampMs <= maxAgeMs
  );
}

function isNewerReading(candidateTimestamp, latestTimestamp) {
  const candidateMs = new Date(candidateTimestamp).getTime();
  if (!Number.isFinite(candidateMs)) return false;
  if (latestTimestamp === null || latestTimestamp === undefined) return true;
  const latestMs = new Date(latestTimestamp).getTime();
  return Number.isFinite(latestMs) && candidateMs > latestMs;
}

function classifyTelemetrySource(
  topic,
  fieldTopic,
  simulationTopic,
  simulated,
  nodeId,
) {
  const isExactOrChildTopic = (candidate, root) =>
    candidate === root || candidate.startsWith(`${root}/`);
  if (isExactOrChildTopic(topic, simulationTopic)) {
    return simulated === true ? "SIMULATED" : "IGNORE";
  }
  if (topic === `${fieldTopic}/${nodeId}`) {
    return simulated === false ? "FIELD" : "IGNORE";
  }
  return "IGNORE";
}

function evaluateStatus(payload, previousStatus, thresholds) {
  if (payload.status === "SENSOR_ERROR" || payload.water_level_cm === null) {
    return "SENSOR_ERROR";
  }

  const waterLevelCm = payload.water_level_cm;
  const warningThreshold = Number(thresholds.warning_cm);
  const criticalThreshold = Number(thresholds.critical_cm);
  const previous = VALID_STATUSES.has(previousStatus) ? previousStatus : "NORMAL";

  if (previous === "CRITICAL") {
    if (waterLevelCm < criticalThreshold - 3) {
      return waterLevelCm < warningThreshold - 3 ? "NORMAL" : "WARNING";
    }
    return "CRITICAL";
  }
  if (previous === "WARNING") {
    if (waterLevelCm >= criticalThreshold) return "CRITICAL";
    if (waterLevelCm < warningThreshold - 3) return "NORMAL";
    return "WARNING";
  }
  if (waterLevelCm >= criticalThreshold) return "CRITICAL";
  if (waterLevelCm >= warningThreshold) return "WARNING";
  return "NORMAL";
}

function residentSafetyState(reading, now = Date.now(), maxAgeMs = 30000) {
  if (!reading) {
    return {
      status: "SENSOR_ERROR",
      data_freshness: "UNAVAILABLE",
      safety_message:
        "Sensor data is unavailable. Flood conditions are unknown; follow local emergency guidance.",
    };
  }

  if (!isFreshReading(reading.timestamp, now, maxAgeMs)) {
    return {
      status: "SENSOR_ERROR",
      data_freshness: "STALE",
      safety_message:
        "Sensor data is stale. Flood conditions are unknown; follow local emergency guidance.",
    };
  }

  if (!VALID_STATUSES.has(reading.status) || reading.status === "SENSOR_ERROR") {
    return {
      status: "SENSOR_ERROR",
      data_freshness: "SENSOR_ERROR",
      safety_message:
        "The sensor reported an error. Flood conditions are unknown; follow local emergency guidance.",
    };
  }

  const safetyMessage = {
    CRITICAL:
      "Water levels are critical near your area. Move to higher ground and stay away from electrical equipment and transformers.",
    WARNING:
      "Water levels are rising near your area. Stay alert, avoid low-lying routes, and keep away from electrical equipment.",
    NORMAL:
      "Current sensor data reports normal water levels. Continue following local safety guidance.",
  }[reading.status];

  return {
    status: reading.status,
    data_freshness: "CURRENT",
    safety_message: safetyMessage,
  };
}

module.exports = {
  areValidThresholds,
  classifyTelemetrySource,
  evaluateStatus,
  isFreshReading,
  isNewerReading,
  residentSafetyState,
};
