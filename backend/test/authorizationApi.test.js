const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const secret = "api-boundary-test-secret-with-at-least-32-characters";
process.env.JWT_SECRET = secret;

const grid = require("../routes/grid-control");
const alerts = require("../routes/alerts");
const nodes = require("../routes/nodes");
const reports = require("../routes/reports");
const gridInspection = require("../routes/grid-inspection");
const adminControlCenter = require("../routes/admin-control-center");
const usersAdmin = require("../routes/users-admin");

const app = express();
app.use(express.json());
app.use("/grid", grid);
app.use("/alerts", alerts);
app.use("/nodes", nodes);
app.use("/reports", reports);
app.use("/grid-inspection", gridInspection);
app.use("/admin/control-center", adminControlCenter);
app.use("/users", usersAdmin);
app.set("wss", { clients: [] });

let server;
let origin;
let activeAccount = {
  username: "test-operator",
  role: "operator",
  active: true,
  assigned_zone: "ZONE-A",
};
const observedQueries = [];
let failAuditInsert = false;

function fakeResult(rows = []) {
  return { rows, rowCount: rows.length };
}

function resetDatabaseMocks() {
  observedQueries.length = 0;
  failAuditInsert = false;
  activeAccount = {
    username: "test-operator",
    role: "operator",
    active: true,
    assigned_zone: "ZONE-A",
  };
  pool.query = async (sql, values = []) => {
    observedQueries.push({ sql, values });
    if (sql.includes("FROM users u") && sql.includes("operational_zones")) {
      return fakeResult([activeAccount]);
    }
    if (sql.includes("FROM grid_equipment ge")) {
      if (sql.includes("$1::boolean") && values[0] === true) {
        return fakeResult([{ id: 1, name: "Synthetic zone A equipment", scope_zone: "ZONE-A" }]);
      }
      if (sql.includes("ge.scope_zone=$2") && values[1] === "ZONE-A") {
        return fakeResult([{ id: 1, name: "Synthetic zone A equipment", scope_zone: "ZONE-A" }]);
      }
      return fakeResult([]);
    }
    if (sql.includes("SELECT * FROM alerts")) {
      if (sql.includes("nodes") && values[0] === "ZONE-A") {
        return fakeResult([{ id: 1, node_id: "NODE-A", scope_zone: "ZONE-A" }]);
      }
      return fakeResult([]);
    }
    if (sql.includes("FROM nodes WHERE scope_zone=$1")) {
      return values[0] === "ZONE-A"
        ? fakeResult([{ node_id: "NODE-A", scope_zone: "ZONE-A" }])
        : fakeResult([]);
    }
    if (sql.includes("SELECT * FROM readings") || sql.includes("SELECT * FROM alerts")) {
      return fakeResult([]);
    }
    if (sql.includes("FROM operational_zones")) {
      return fakeResult([{ zone_code: "ZONE-B" }]);
    }
    return fakeResult();
  };

  pool.connect = async () => ({
    async query(sql, values = []) {
      observedQueries.push({ sql, values });
      if (sql.includes("INSERT INTO audit_logs") && failAuditInsert) {
        throw new Error("synthetic audit failure");
      }
      if (sql.includes("INSERT INTO users")) {
        return fakeResult([{ id: 8, username: "new-user", role: "operator" }]);
      }
      if (sql.includes("DELETE FROM users")) {
        return fakeResult([{ id: 8 }]);
      }
      if (sql.includes("FROM alerts a JOIN nodes n")) {
        return fakeResult([{ one: 1 }]);
      }
      if (sql.includes("UPDATE alerts")) {
        return fakeResult([]);
      }
      if (sql.includes("UPDATE grid_equipment")) {
        return fakeResult([]);
      }
      if (sql.includes("UPDATE users")) {
        return fakeResult([{ id: 8, username: "new-user", role: "operator", active: true }]);
      }
      return fakeResult();
    },
    release() {},
  });
}

function token(overrides = {}) {
  return jwt.sign(
    {
      user_id: 7,
      username: "test-operator",
      role: "operator",
      ...overrides,
    },
    secret,
  );
}

async function request(path, { method = "GET", jwtToken = token(), body } = {}) {
  return fetch(`${origin}${path}`, {
    method,
    headers: {
      ...(jwtToken ? { authorization: `Bearer ${jwtToken}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test("operator API list routes apply exact database-backed zone predicates", async () => {
  resetDatabaseMocks();
  for (const path of ["/grid", "/alerts", "/nodes", "/reports"]) {
    observedQueries.length = 0;
    const response = await request(path);
    assert.equal(response.status, 200, path);
    const body = await response.json();
    if (path === "/grid") {
      assert.deepEqual(body.map((row) => row.scope_zone), ["ZONE-A"]);
      assert.ok(observedQueries.some(({ sql, values }) =>
        sql.includes("ge.scope_zone=$2") && values[1] === "ZONE-A"));
    } else if (path === "/alerts") {
      assert.deepEqual(body.map((row) => row.node_id), ["NODE-A"]);
      assert.ok(observedQueries.some(({ sql, values }) =>
        sql.includes("nodes") && values[0] === "ZONE-A"));
    } else if (path === "/nodes") {
      assert.deepEqual(body.map((row) => row.node_id), ["NODE-A"]);
    } else {
      assert.deepEqual(body.summary, { readings: 1, alerts: 1 });
      const reportQueries = observedQueries.filter(({ sql }) =>
        sql.includes("SELECT * FROM readings") || sql.includes("SELECT * FROM alerts"));
      assert.equal(reportQueries.length, 2);
      assert.ok(reportQueries.every(({ sql, values }) =>
        sql.includes("scope_zone=$1") && values[0] === "ZONE-A"));
    }
  }
});

test("administrators can view all grid records while residents see subscribed nodes only", async () => {
  resetDatabaseMocks();
  activeAccount = {
    username: "test-admin",
    role: "admin",
    active: true,
    assigned_zone: null,
  };
  const adminResponse = await request("/grid", {
    jwtToken: token({ username: "test-admin", role: "admin" }),
  });
  assert.equal(adminResponse.status, 200);
  assert.equal((await adminResponse.json()).length, 1);
  assert.ok(observedQueries.some(({ sql, values }) =>
    sql.includes("$1::boolean") && values[0] === true));

  resetDatabaseMocks();
  activeAccount = {
    username: "+15550000001",
    role: "resident",
    active: true,
    assigned_zone: null,
  };
  pool.query = async (sql, values = []) => {
    observedQueries.push({ sql, values });
    if (sql.includes("FROM users u") && sql.includes("operational_zones")) {
      return fakeResult([activeAccount]);
    }
    if (sql.includes("FROM nodes n JOIN subscribers s")) {
      return fakeResult([{ node_id: "NODE-RESIDENT", name: "Subscribed node" }]);
    }
    return fakeResult();
  };
  const residentResponse = await request("/nodes", {
    jwtToken: token({ username: "+15550000001", role: "resident" }),
  });
  assert.equal(residentResponse.status, 200);
  assert.deepEqual((await residentResponse.json()).map((node) => node.node_id), ["NODE-RESIDENT"]);
  assert.ok(observedQueries.some(({ sql, values }) =>
    sql.includes("s.phone = $1") && values[0] === "+15550000001"));
});

test("unassigned operators are denied grid data and threshold mutation", async () => {
  resetDatabaseMocks();
  activeAccount = { ...activeAccount, assigned_zone: null };
  const gridResponse = await request("/grid");
  assert.equal(gridResponse.status, 403);
  assert.doesNotMatch(await gridResponse.text(), /Synthetic zone A/);

  const thresholdResponse = await request("/admin/control-center/thresholds", {
    method: "PUT",
    body: { warning_cm: 40, critical_cm: 60, reason: "synthetic test" },
  });
  assert.equal(thresholdResponse.status, 403);
  assert.equal(observedQueries.some(({ sql }) => sql.includes("system_settings")), false);
});

test("threshold changes are administrator-only and audited in the same transaction", async () => {
  resetDatabaseMocks();
  activeAccount = {
    username: "test-admin",
    role: "admin",
    active: true,
    assigned_zone: null,
  };
  const adminToken = token({ username: "test-admin", role: "admin" });
  const update = await request("/admin/control-center/thresholds", {
    method: "PUT",
    jwtToken: adminToken,
    body: { warning_cm: 40, critical_cm: 60, reason: "synthetic test" },
  });
  assert.equal(update.status, 200);
  assert.ok(observedQueries.some(({ sql }) => sql.includes("INSERT INTO system_settings")));
  assert.ok(observedQueries.some(({ sql }) => sql.includes("INSERT INTO audit_logs")));
  assert.ok(observedQueries.some(({ sql }) => sql === "COMMIT"));

  resetDatabaseMocks();
  activeAccount = {
    username: "test-admin",
    role: "admin",
    active: true,
    assigned_zone: null,
  };
  failAuditInsert = true;
  const failedUpdate = await request("/admin/control-center/thresholds", {
    method: "PUT",
    jwtToken: adminToken,
    body: { warning_cm: 40, critical_cm: 60, reason: "synthetic test" },
  });
  assert.equal(failedUpdate.status, 500);
  assert.ok(observedQueries.some(({ sql }) => sql === "ROLLBACK"));
  assert.equal(observedQueries.some(({ sql }) => sql === "COMMIT"), false);
});

test("operator grid actions reject out-of-scope resources without disclosing records", async () => {
  resetDatabaseMocks();
  const cutoff = await request("/grid/999/cutoff", { method: "POST" });
  assert.equal(cutoff.status, 404);
  assert.doesNotMatch(await cutoff.text(), /equipment name|scope_zone/i);

  const inspection = await request("/grid-inspection/999/inspect", {
    method: "POST",
    body: { notes: "synthetic inspection" },
  });
  assert.equal(inspection.status, 404);
  assert.doesNotMatch(await inspection.text(), /equipment name|scope_zone/i);
  assert.ok(observedQueries.some(({ sql, values }) =>
    sql.includes("UPDATE grid_equipment") &&
    sql.includes("scope_zone=$3") &&
    values[2] === "ZONE-A"));
});

test("operator alert mutations retain a scope predicate at update time", async () => {
  resetDatabaseMocks();
  const response = await request("/alerts/42/resolve", {
    method: "POST",
    body: { reason: "synthetic test" },
  });
  assert.equal(response.status, 404);
  const update = observedQueries.find(({ sql }) => sql.includes("UPDATE alerts"));
  assert.ok(update);
  assert.match(update.sql, /EXISTS[\s\S]*n\.scope_zone=\$6/);
  assert.equal(update.values[5], "ZONE-A");

  observedQueries.length = 0;
  const acknowledgement = await request("/alerts/42/ack", { method: "POST" });
  assert.equal(acknowledgement.status, 404);
  const acknowledgementUpdate = observedQueries.find(({ sql }) =>
    sql.includes("UPDATE alerts"));
  assert.ok(acknowledgementUpdate);
  assert.match(acknowledgementUpdate.sql, /EXISTS[\s\S]*n\.scope_zone=\$4/);
  assert.equal(acknowledgementUpdate.values[3], "ZONE-A");
});

test("authentication failures are denied at the API boundary", async () => {
  resetDatabaseMocks();
  const missing = await request("/grid", { jwtToken: null });
  assert.equal(missing.status, 401);

  activeAccount = { ...activeAccount, active: false };
  const inactive = await request("/grid");
  assert.equal(inactive.status, 403);
});

test("administrator user mutations audit transactionally and roll back on audit failure", async () => {
  resetDatabaseMocks();
  activeAccount = {
    username: "test-admin",
    role: "admin",
    active: true,
    assigned_zone: null,
  };
  const adminToken = token({ username: "test-admin", role: "admin" });
  const create = await request("/users", {
    method: "POST",
    jwtToken: adminToken,
    body: { username: "new-user", password: "synthetic-password", role: "operator" },
  });
  assert.equal(create.status, 201);
  assert.ok(observedQueries.some(({ sql }) => sql.includes("INSERT INTO audit_logs")));
  assert.ok(observedQueries.some(({ sql }) => sql === "COMMIT"));

  resetDatabaseMocks();
  activeAccount = {
    username: "test-admin",
    role: "admin",
    active: true,
    assigned_zone: null,
  };
  failAuditInsert = true;
  const update = await request("/users/8", {
    method: "PATCH",
    jwtToken: adminToken,
    body: { assigned_zone: "ZONE-B" },
  });
  assert.equal(update.status, 500);
  assert.ok(observedQueries.some(({ sql }) => sql === "ROLLBACK"));
  assert.equal(observedQueries.some(({ sql }) => sql === "COMMIT"), false);

  resetDatabaseMocks();
  activeAccount = {
    username: "test-admin",
    role: "admin",
    active: true,
    assigned_zone: null,
  };
  const updatedUser = await request("/users/8", {
    method: "PATCH",
    jwtToken: adminToken,
    body: { assigned_zone: "ZONE-B" },
  });
  assert.equal(updatedUser.status, 200);
  assert.ok(observedQueries.some(({ sql }) => sql.includes("UPDATE users")));
  assert.ok(observedQueries.some(({ sql }) => sql.includes("INSERT INTO audit_logs")));
  assert.ok(observedQueries.some(({ sql }) => sql === "COMMIT"));

  resetDatabaseMocks();
  activeAccount = {
    username: "test-admin",
    role: "admin",
    active: true,
    assigned_zone: null,
  };
  const deletedUser = await request("/users/8", {
    method: "DELETE",
    jwtToken: adminToken,
  });
  assert.equal(deletedUser.status, 204);
  assert.ok(observedQueries.some(({ sql }) => sql.includes("DELETE FROM users")));
  assert.ok(observedQueries.some(({ sql }) => sql.includes("INSERT INTO audit_logs")));
  assert.ok(observedQueries.some(({ sql }) => sql === "COMMIT"));
});
