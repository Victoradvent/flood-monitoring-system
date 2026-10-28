const test = require("node:test");
const assert = require("node:assert/strict");
const {
  areValidThresholds,
  classifyTelemetrySource,
  evaluateStatus,
  isFreshReading,
  isNewerReading,
  residentSafetyState,
} = require("../services/telemetrySafety");

const thresholds = { warning_cm: 30, critical_cm: 50 };
const now = Date.parse("2026-10-28T10:00:00.000Z");

test("threshold configuration must be finite, ordered, and within telemetry range", () => {
  assert.equal(areValidThresholds(thresholds), true);
  assert.equal(
    areValidThresholds({ warning_cm: 50, critical_cm: 50 }),
    false,
  );
  assert.equal(
    areValidThresholds({ warning_cm: 30, critical_cm: 1001 }),
    false,
  );
  assert.equal(
    areValidThresholds({ warning_cm: Number.NaN, critical_cm: 50 }),
    false,
  );
});

test("classifies configured warning and critical levels", () => {
  assert.equal(
    evaluateStatus({ status: "NORMAL", water_level_cm: 30 }, "NORMAL", thresholds),
    "WARNING",
  );
  assert.equal(
    evaluateStatus({ status: "NORMAL", water_level_cm: 50 }, "NORMAL", thresholds),
    "CRITICAL",
  );
});

test("applies hysteresis to warning and critical recovery", () => {
  assert.equal(
    evaluateStatus({ status: "NORMAL", water_level_cm: 48 }, "CRITICAL", thresholds),
    "CRITICAL",
  );
  assert.equal(
    evaluateStatus({ status: "NORMAL", water_level_cm: 46 }, "CRITICAL", thresholds),
    "WARNING",
  );
  assert.equal(
    evaluateStatus({ status: "NORMAL", water_level_cm: 27 }, "WARNING", thresholds),
    "WARNING",
  );
  assert.equal(
    evaluateStatus({ status: "NORMAL", water_level_cm: 26.9 }, "WARNING", thresholds),
    "NORMAL",
  );
});

test("sensor errors do not establish normal conditions", () => {
  assert.equal(
    evaluateStatus(
      { status: "SENSOR_ERROR", water_level_cm: null },
      "CRITICAL",
      thresholds,
    ),
    "SENSOR_ERROR",
  );
});

test("freshness accepts current readings and rejects stale, future, or invalid times", () => {
  assert.equal(isFreshReading(new Date(now - 30000).toISOString(), now, 30000), true);
  assert.equal(isFreshReading(new Date(now - 30001).toISOString(), now, 30000), false);
  assert.equal(isFreshReading(new Date(now + 1).toISOString(), now, 30000), false);
  assert.equal(isFreshReading("not-a-timestamp", now, 30000), false);
  assert.equal(isFreshReading(null, now, 30000), false);
});

test("duplicate and out-of-order readings cannot advance a node's current state", () => {
  const latest = "2026-10-28T09:59:59.000Z";
  assert.equal(isNewerReading("2026-10-28T09:59:59.000Z", latest), false);
  assert.equal(isNewerReading("2026-10-28T09:59:58.000Z", latest), false);
  assert.equal(isNewerReading("2026-10-28T10:00:00.000Z", latest), true);
  assert.equal(isNewerReading("not-a-timestamp", latest), false);
});

test("simulated telemetry is isolated by topic and explicit marker", () => {
  assert.equal(
    classifyTelemetrySource(
      "nodes/flood/simulated",
      "nodes/flood",
      "nodes/flood/simulated",
      true,
    ),
    "SIMULATED",
  );
  assert.equal(
    classifyTelemetrySource(
      "nodes/flood",
      "nodes/flood",
      "nodes/flood/simulated",
      true,
    ),
    "IGNORE",
  );
  assert.equal(
    classifyTelemetrySource(
      "nodes/flood/simulated",
      "nodes/flood",
      "nodes/flood/simulated",
      false,
    ),
    "IGNORE",
  );
  assert.equal(
    classifyTelemetrySource(
      "nodes/flood",
      "nodes/flood",
      "nodes/flood/simulated",
      false,
    ),
    "FIELD",
  );
});

test("missing and stale resident readings fail safe as unknown", () => {
  const missing = residentSafetyState(null, now, 30000);
  assert.equal(missing.status, "SENSOR_ERROR");
  assert.equal(missing.data_freshness, "UNAVAILABLE");
  assert.match(missing.safety_message, /unknown/i);

  const stale = residentSafetyState(
    { status: "NORMAL", timestamp: new Date(now - 30001).toISOString() },
    now,
    30000,
  );
  assert.equal(stale.status, "SENSOR_ERROR");
  assert.equal(stale.data_freshness, "STALE");
  assert.match(stale.safety_message, /unknown/i);
});

test("sensor errors and fresh hazard levels have distinct safety states", () => {
  const sensorError = residentSafetyState(
    { status: "SENSOR_ERROR", timestamp: new Date(now).toISOString() },
    now,
    30000,
  );
  assert.equal(sensorError.status, "SENSOR_ERROR");
  assert.equal(sensorError.data_freshness, "SENSOR_ERROR");

  const critical = residentSafetyState(
    { status: "CRITICAL", timestamp: new Date(now).toISOString() },
    now,
    30000,
  );
  assert.equal(critical.status, "CRITICAL");
  assert.equal(critical.data_freshness, "CURRENT");

  const normal = residentSafetyState(
    { status: "NORMAL", timestamp: new Date(now).toISOString() },
    now,
    30000,
  );
  assert.match(normal.safety_message, /current sensor data/i);
  assert.doesNotMatch(normal.safety_message, /no action needed/i);
});
