const test = require("node:test");
const assert = require("node:assert/strict");

test("builds a same-origin WebSocket URL with an encoded token", async () => {
  const { createWebSocketUrl } = await import("../src/websocketUrl.mjs");
  assert.equal(
    createWebSocketUrl("wss://dashboard.example/ws", "token value"),
    "wss://dashboard.example/ws?token=token+value",
  );
});

test("preserves configured query parameters", async () => {
  const { createWebSocketUrl } = await import("../src/websocketUrl.mjs");
  assert.equal(
    createWebSocketUrl("wss://dashboard.example/ws?tenant=one", "jwt"),
    "wss://dashboard.example/ws?tenant=one&token=jwt",
  );
});

test("clears token when no token is provided", async () => {
  const { createWebSocketUrl } = await import("../src/websocketUrl.mjs");
  assert.equal(
    createWebSocketUrl("ws://localhost:3000/ws", ""),
    "ws://localhost:3000/ws?token=",
  );
});
