async function createAlertWithRecipients(
  pool,
  { nodeId, level, waterLevelCm, cooldownSeconds },
) {
  const database = await pool.connect();
  let transactionStarted = false;
  try {
    await database.query("BEGIN");
    transactionStarted = true;
    await database.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `alert:${nodeId}`,
    ]);

    const existing = await database.query(
      `SELECT id
         FROM alerts
        WHERE node_id=$1
          AND alert_level=$2
          AND triggered_at >= NOW() - ($3 * INTERVAL '1 second')
        ORDER BY triggered_at DESC
        LIMIT 1`,
      [nodeId, level, cooldownSeconds],
    );
    if (existing.rowCount) {
      await database.query("COMMIT");
      transactionStarted = false;
      return { id: existing.rows[0].id, created: false };
    }

    const alert = await database.query(
      `INSERT INTO alerts (node_id, alert_level, water_level_cm, sent, provider, provider_response)
       VALUES ($1, $2, $3, FALSE, NULL, NULL)
       RETURNING id`,
      [nodeId, level, waterLevelCm],
    );
    const alertId = alert.rows[0].id;
    await database.query(
      `INSERT INTO alert_recipients
         (alert_id, subscriber_id, status, attempts, next_attempt_at)
       SELECT $1, id, 'PENDING', 0, NOW()
         FROM subscribers
        WHERE node_id=$2
          AND active=TRUE
          AND role IN ('operator', 'resident')`,
      [alertId, nodeId],
    );

    await database.query("COMMIT");
    transactionStarted = false;
    return { id: alertId, created: true };
  } catch (error) {
    if (transactionStarted) {
      try {
        await database.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Alert transaction rollback failed", rollbackError);
      }
    }
    throw error;
  } finally {
    database.release();
  }
}

module.exports = { createAlertWithRecipients };
