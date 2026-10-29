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
- The firmware now requires per-device credentials and a configured CA, and
  publishes to a topic whose device ID must match the payload. The broker and
  backend are configured for TLS certificate validation. Firmware build,
  certificate/hostname behavior, and live broker ACL enforcement remain
  unverified; do not treat configuration as field validation.
- `operational_zones` and foreign-key-backed user, node, and equipment zone
  mappings provide exact operator scoping. Existing users, nodes, and equipment
  are intentionally not auto-mapped; until an administrator assigns verified
  mappings, operators receive no scoped access. A database mapping alone does
  not verify physical asset-to-sensor relationships.
- Audit entries are written in the application database but are not protected
  by an independently administered, append-only audit store.
- Local `.env` files, Mosquitto password databases, and broker persistence
  files must remain untracked. Git path history includes `.env` and
  `mosquitto/config/passwordfile`; their contents were not displayed, but treat
  their credentials as compromised and rotate them through an authorized
  deployment process. History is not erased by ignoring or untracking them.
  Keep active secrets on the deployment host or in an approved secrets manager.
- `docker-compose.yml` is a development stack, not a production deployment.
  Development TLS certificates use a local CA and are not a production trust
  chain. Production requires managed certificates, provisioned Mosquitto
  credentials/ACLs, TLS termination,
  restricted service/database identities, and reviewed network exposure.
- No production deployment, backup/restore, field validation, or physical
  electrical action has been performed or verified by this change.

## Configuration and testing

Copy `.env.example` to `.env` for local Compose use, replace every
`REPLACE_WITH_*` value, and provision the backend and distinct
`sim_user` accounts (named `mqtt_backend` and `sim_user`) in
`mosquitto/config/passwordfile` with `mosquitto_passwd` without
putting credentials on a command line. `sim_user` is ACL-restricted to
`nodes/simulated/flood`; field publishers cannot write to that topic. Each
field username must equal its provisioned node ID and is restricted by the ACL
to `nodes/flood/<username>`. The backend image excludes local environment
files. Use `SMS_PROVIDER=simulated` for testing; never enable a real SMS
provider in a test environment.

Run backend regression tests with `npm --prefix backend test`; frontend tests
and production builds with `npm --prefix react-dashboard ci`, `npm --prefix
react-dashboard test`, and `npm --prefix react-dashboard run build`. The CI
workflow runs locked installs, tests, audits, container builds, and isolated
database migration checks. The migration verifier is CI-only; it is configured
to create and drop uniquely named disposable databases on the workflow's local
PostgreSQL service and checks preservation of synthetic node, equipment,
operator, alert, and audit records, including an unmapped legacy operator
assignment. Never point it at a production cluster.

The local environment did not provide Docker or PostgreSQL, so no database,
MQTT broker, full telemetry-to-alert, firmware, or frontend browser
integration test was executed here. Do not send test messages to real
recipients or connect test firmware to live equipment.

To load simulated fixtures into a disposable development database only, apply
the SQL files in `db/dev-seed/` after normal schema initialization. Do not run
those files against a site database.

## Migrations, monitoring, backup, and rollback

Files in `db/init/` are executed only when PostgreSQL initializes an empty
data directory. They are not a migration runner. For an existing installation,
review and apply each unapplied, numbered SQL change with an operator-approved
database migration procedure; specifically verify the current schema before
applying later schema changes. The CI migration verifier tests a fresh schema
and a representative pre-018 upgrade with synthetic data; run it in CI before
release. No migration was executed against a live database in this environment.

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

- **PASS:** Backend unit/regression suite, 29/29 tests. This includes telemetry
  freshness, thresholds/hysteresis, simulation namespace/source identity,
  active-account/role checks, exact zone matching, durable alert/queue
  persistence, and Express API boundary tests for administrator, operator, and
  resident access, threshold authorization, alert scope, and transactional
  account/audit behavior. API-boundary tests use a mocked database; they do not
  replace PostgreSQL integration tests.
- **PASS:** Frontend unit tests, 3/3 tests.
- **PASS:** Frontend Vite 7 production build, 3/3 tests, and fresh dependency
  audit: 0 vulnerabilities. The previous audit reported 36 (15 high, 6
  moderate, 15 low). The bundle emits a 1.03 MB main-chunk performance
  warning; no performance benchmark was run. The most recent build is
  verified; the clean locked install was completed in the preceding run.
- **PASS:** Backend test suite, fresh production dependency audit: 0
  vulnerabilities, edited JavaScript syntax, PowerShell certificate-script
  parse, and CRLF-aware whitespace check.
- **NOT RUN:** PostgreSQL/PostGIS migration verifier. A CI workflow and an
  isolated fresh/upgrade migration verifier were added, including synthetic
  preservation checks for node, equipment, operator, alert, and audit data,
  but no database service was available locally and the workflow has not yet
  run.
- **BLOCKED:** End-to-end MQTT-to-alert/notification/WebSocket tests, live
  Mosquitto TLS/ACL verification, firmware build, Docker image/Compose checks,
  and browser E2E/performance tests. Docker, PostgreSQL, and the ESP32 toolchain
  were unavailable locally. Source/configuration changes are not field or
  broker validation.
- **NOT RUN:** Secret-scanning workflow, backup/restore, monitoring, rollback,
  staging deployment, and production deployment. No staging/production
  approval or valid operational credentials were provided.

Release identifier: `unreleased`; no release image or deployment artifact was
created. Previous-session results are historical and are not current evidence.

Staging and production remain blocked until CI migration results, broker and
end-to-end tests, firmware build and device validation, field calibration,
provisioned secrets, verified backup/restore, monitoring, rollback exercises,
and explicit deployment authorization are available.
