const pool = require("../db");

async function logAudit(equipmentId, operatorId, action, notes, database = pool) {
  await database.query(
    "INSERT INTO audit_logs (equipment_id, operator_id, action, notes) VALUES ($1,$2,$3,$4)",
    [equipmentId, operatorId, action, notes],
  );
}

module.exports = { logAudit };
