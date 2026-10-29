const test = require("node:test");
const assert = require("node:assert/strict");
const { canAccessZone, normalizeZoneCode } = require("../services/accessControl");

test("zone codes are normalized and invalid values fail closed", () => {
  assert.equal(normalizeZoneCode(" awka_1 "), "AWKA_1");
  assert.equal(normalizeZoneCode(""), null);
  assert.equal(normalizeZoneCode("Awka North"), null);
  assert.equal(normalizeZoneCode(null), null);
});

test("operators can access only resources in their exact assigned zone", () => {
  assert.equal(canAccessZone("operator", "awka-1", "AWKA-1"), true);
  assert.equal(canAccessZone("operator", "awka-1", "AWKA-10"), false);
  assert.equal(canAccessZone("operator", "awka-1", "NNEWI-1"), false);
});

test("unassigned operators and non-operator roles cannot access scoped resources", () => {
  assert.equal(canAccessZone("operator", null, "AWKA-1"), false);
  assert.equal(canAccessZone("operator", " ", "AWKA-1"), false);
  assert.equal(canAccessZone("resident", "AWKA-1", "AWKA-1"), false);
});

test("administrators retain access without an operator assignment", () => {
  assert.equal(canAccessZone("admin", null, null), true);
});

test("alert and grid scoping share exact-zone access rules", () => {
  for (const resource of ["alert", "grid_equipment"]) {
    assert.equal(
      canAccessZone("operator", "AWKA-1", "NNEWI-1"),
      false,
      `${resource} must deny a cross-zone operator`,
    );
  }
});
