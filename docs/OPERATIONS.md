# Operations and Release Gates

## Architecture and data boundaries

ESP32 nodes publish centimetre readings to Mosquitto. The Express service
validates MQTT payloads, writes PostgreSQL/PostGIS records, evaluates configured
warning/critical levels, and distributes authorized events over WebSockets.
Resident and operator notifications are separate SMS deliveries. Grid actions
are recommendations only; this system has no physical switching interface.

Telemetry marked `simulated: true` is sent only to administrator WebSocket
clients. It is not stored as field readings and cannot create alerts, SMS
deliveries, or grid recommendations. Development node, subscriber, and grid
fixtures are in `db/dev-seed/`; they are not applied by database initialization.
Treat all other accepted telemetry as unverified until device identity and
field provenance have been independently established.

## Safety and security findings

- Stale, missing, future-dated, duplicate, or out-of-order telemetry is not
  allowed to update live hazard state. Resident status becomes `SENSOR_ERROR`
  when its latest reading is missing, invalid, or older than
  `READING_STALE_AFTER_SEC` (default 30 seconds). This is an operational
  freshness limit based on the firmware's 10-second sampling interval, not a
  flood threshold; validate it against actual network behavior before use.
- The existing 30 cm warning and 50 cm critical settings are inherited software
  defaults, not field-validated thresholds or regulatory guidance. Verify
  sensor calibration, units, thresholds, hysteresis, siting, and escalation
  with qualified local authorities before operational use.
- The checked-in ESP32 firmware currently uses plaintext MQTT on port 1883 and
  embedded placeholder credentials. It does not match the Compose TLS broker
  configuration and must not be used on an untrusted network or in the field.
- Grid equipment has no verified node/zone assignment. Operator access to grid
  records and recommendation/inspection actions is not safely scoped by an
  authoritative equipment mapping; disable operator grid actions or add and
  validate that mapping before operational use.
- Audit entries are written in the application database but are not protected
  by an independently administered, append-only audit store.
- Local `.env` files, Mosquitto password databases, and broker persistence
  files must remain untracked. Rotate any credentials that have ever been
  committed. Keep them on the deployment host or in an approved secrets manager.
- `docker-compose.yml` is a development stack, not a production deployment.
  Development TLS certificates are self-signed. Production requires a managed
  trust chain, provisioned Mosquitto credentials/ACLs, TLS termination,
  restricted service/database identities, and reviewed network exposure.
- No production deployment, backup/restore, field validation, or physical
  electrical action has been performed or verified by this change.

## Configuration and testing

Copy `.env.example` to `.env` for local Compose use, replace every
`REPLACE_WITH_*` value, and provision both `mqtt_user` and the distinct
`sim_user` in `mosquitto/config/passwordfile` with `mosquitto_passwd` without
putting credentials on a command line. `sim_user` is ACL-restricted to
`nodes/flood/simulated`; field publishers cannot write to that topic. The
backend image excludes local environment files. Use `SMS_PROVIDER=simulated`
for testing; never enable a real SMS provider in a test environment.

Run backend regression tests with `npm --prefix backend test`. Frontend
production builds require the React dependencies (`npm --prefix
react-dashboard ci`, then `npm --prefix react-dashboard run build`). The
repository has no automated database, broker, end-to-end, or firmware test
harness. Do not send test messages to real recipients or connect test firmware
to live equipment.

To load simulated fixtures into a disposable development database only, apply
the SQL files in `db/dev-seed/` after normal schema initialization. Do not run
those files against a site database.

## Migrations, monitoring, backup, and rollback

Files in `db/init/` are executed only when PostgreSQL initializes an empty
data directory. They are not a migration runner. For an existing installation,
review and apply each unapplied, numbered SQL change with an operator-approved
database migration procedure; specifically verify the current schema before
applying later schema changes. The migrations have not been tested against a
live or disposable PostgreSQL instance in this environment.

`GET /health` checks application dependencies only and explicitly does not
indicate that flood conditions are safe. Readiness includes database, MQTT, and
loaded/validated threshold settings; field readings are ignored until those
settings are available. Monitor last-reading age by node, sensor errors,
rejected/stale messages, alert delivery retries, and audit-log failures.
Establish alert thresholds and on-call ownership before operations; no
monitoring backend is configured here.

Before any staging or production migration, take a database-consistent,
encrypted backup and verify a restore to an isolated database. Record the
backup identifier and restore evidence. Preserve the existing database volume;
do not use `docker compose down -v`. Roll back application images/configuration
only after checking schema compatibility. Prefer a forward-fix for committed
database changes unless a tested reverse migration and restore point exist.
No backup, restore, rollback, migration, or deployment evidence is available
from this workspace.

## Release status and limitations

Release identifier: `unreleased` (no commit or packaged release artifact was
created).

### Verification record

- **PASS:** Backend regression suite, 9/9 tests (`npm --prefix backend test`).
- **PASS:** Frontend production build (`npm --prefix react-dashboard run build`).
- **PASS:** Backend dependency audit after compatible updates, 0 reported
  vulnerabilities.
- **BLOCKED:** Frontend dependency audit reports 36 vulnerabilities (15 high,
  6 moderate, 15 low). A non-forced `npm audit fix` reduced the initial report
  from 47, including 2 critical, but did not clear the legacy `react-scripts`
  dependency tree. Many remaining fixes require breaking changes; `--force`
  was not used.
- **PASS:** Changed backend JavaScript syntax checks, including the interactive
  bootstrap password prompt; CRLF-aware whitespace check.
- **NOT RUN / BLOCKED:** Docker image/Compose checks, database migrations and
  integration tests, MQTT/TLS ACL verification, firmware build/field tests,
  end-to-end/performance tests, backup/restore, monitoring, rollback, staging,
  and production deployment. Docker and the required isolated/live
  infrastructure are unavailable here.
- No production build image, release artifact, backup, or deployment evidence
  was created. No staging or production approval was provided.

Staging and production remain blocked pending remediation of the frontend
dependency audit, isolated database and broker integration tests, firmware TLS
and device-identity validation, approved field calibration, provisioned
secrets, verified backup/restore, monitoring and rollback exercises, and
explicit deployment authorization.
