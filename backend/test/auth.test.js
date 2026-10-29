const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { createAuthenticateToken, requireRole } = require("../auth");

const secret = "test-only-signing-key-with-at-least-32-characters";

function invokeMiddleware(middleware, token) {
  return new Promise((resolve) => {
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {
      statusCode: 200,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        resolve({ req, res: this });
      },
    };
    middleware(req, res, () => resolve({ req, res, next: true }));
  });
}

function token(role = "operator") {
  return jwt.sign({ user_id: 7, username: "test-user", role }, secret);
}

test("authentication rejects inactive accounts", async () => {
  const middleware = createAuthenticateToken(
    { query: async () => ({ rows: [{ username: "test-user", role: "operator", active: false, assigned_zone: "ZONE-1" }] }) },
    () => secret,
  );
  const result = await invokeMiddleware(middleware, token());
  assert.equal(result.res.statusCode, 403);
});

test("authentication rejects a token whose role was escalated", async () => {
  const middleware = createAuthenticateToken(
    { query: async () => ({ rows: [{ username: "test-user", role: "operator", active: true, assigned_zone: null }] }) },
    () => secret,
  );
  const result = await invokeMiddleware(middleware, token("admin"));
  assert.equal(result.res.statusCode, 403);
});

test("authentication applies the database-backed role and scope", async () => {
  const middleware = createAuthenticateToken(
    { query: async () => ({ rows: [{ username: "test-user", role: "operator", active: true, assigned_zone: "ZONE-1" }] }) },
    () => secret,
  );
  const result = await invokeMiddleware(middleware, token());
  assert.equal(result.next, true);
  assert.equal(result.req.user.role, "operator");
  assert.equal(result.req.user.assigned_zone, "ZONE-1");
});

test("operator role cannot pass administrator-only changes", () => {
  let nextCalled = false;
  const res = {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json() {},
  };
  requireRole("admin")({ user: { role: "operator" } }, res, () => {
    nextCalled = true;
  });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});
