const test = require("node:test");
const assert = require("node:assert/strict");
const { createAlertWithRecipients } = require("../services/alertStore");

function createPool({ existingId = null, failOn = null } = {}) {
  const state = { queries: [], releaseCount: 0 };
  const database = {
    async query(sql, values = []) {
      state.queries.push({ sql, values });
      if (failOn && sql.includes(failOn)) throw new Error("database failure");
      if (sql.includes("SELECT id") && sql.includes("FROM alerts")) {
        return existingId
          ? { rowCount: 1, rows: [{ id: existingId }] }
          : { rowCount: 0, rows: [] };
      }
      if (sql.includes("INSERT INTO alerts")) {
        return { rowCount: 1, rows: [{ id: 21 }] };
      }
      return { rowCount: 0, rows: [] };
    },
    release() {
      state.releaseCount += 1;
    },
  };
  return {
    state,
    pool: { connect: async () => database },
  };
}

const alert = {
  nodeId: "NODE-TEST",
  level: "WARNING",
  waterLevelCm: 32,
  cooldownSeconds: 900,
};

test("alert insert and notification queue are committed atomically", async () => {
  const { pool, state } = createPool();
  const result = await createAlertWithRecipients(pool, alert);

  assert.deepEqual(result, { id: 21, created: true });
  assert.ok(state.queries.some(({ sql }) => sql.includes("INSERT INTO alerts")));
  const queueInsert = state.queries.find(({ sql }) =>
    sql.includes("INSERT INTO alert_recipients"),
  );
  assert.ok(queueInsert);
  assert.match(queueInsert.sql, /active=TRUE/);
  assert.match(queueInsert.sql, /role IN \('operator', 'resident'\)/);
  assert.equal(state.queries.at(-1).sql, "COMMIT");
  assert.equal(state.releaseCount, 1);
});

test("a persisted alert suppresses duplicates after process restart", async () => {
  const { pool, state } = createPool({ existingId: 9 });
  const result = await createAlertWithRecipients(pool, alert);

  assert.deepEqual(result, { id: 9, created: false });
  assert.ok(state.queries.some(({ sql }) => sql.includes("INTERVAL '1 second'")));
  assert.equal(state.queries.some(({ sql }) => sql.includes("INSERT INTO alerts")), false);
  assert.equal(state.queries.some(({ sql }) => sql.includes("INSERT INTO alert_recipients")), false);
});

test("failed alert persistence rolls back and releases its connection", async () => {
  const { pool, state } = createPool({ failOn: "INSERT INTO alert_recipients" });

  await assert.rejects(createAlertWithRecipients(pool, alert), /database failure/);
  assert.equal(state.queries.at(-1).sql, "ROLLBACK");
  assert.equal(state.releaseCount, 1);
});
