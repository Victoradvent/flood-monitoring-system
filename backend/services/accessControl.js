function normalizeZoneCode(value) {
  if (typeof value !== "string") return null;
  const zoneCode = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(zoneCode)
    ? zoneCode.toUpperCase()
    : null;
}

function canAccessZone(role, assignedZone, resourceZone) {
  if (role === "admin") return true;
  const assigned = normalizeZoneCode(assignedZone);
  const resource = normalizeZoneCode(resourceZone);
  return role === "operator" && assigned !== null && assigned === resource;
}

module.exports = { normalizeZoneCode, canAccessZone };
