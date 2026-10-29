# Flood Monitoring System

A real-time flood monitoring and grid equipment control system with automatic hazard detection and cutoff recommendations.

*Features:
Real-time water level monitoring via MQTT
Automatic critical hazard detection
Grid equipment cutoff recommendations only (no actual power switching)
SMS alerts (Twilio integration)
Web dashboard with live updates
Audit logging for all actions
Role-based access control (Admin, Operator)
Historical data & trending analysis

## Quick Start

### Local Development

```bash
# Install dependencies
npm --prefix backend ci
npm --prefix react-dashboard ci

# Set up environment
cp .env.example .env

# Provision a local Mosquitto password file (the tool prompts for the password)
mosquitto_passwd -c mosquitto/config/passwordfile mqtt_backend
mosquitto_passwd mosquitto/config/passwordfile sim_user
mosquitto_passwd mosquitto/config/passwordfile mqtt_backend

# Generate development-only MQTT certificates, then start with Docker
.\scripts\generate-dev-certs.ps1
docker compose up --build
```

**Access:**

- Frontend: http://localhost:8080
- Backend API: http://localhost:3000
- MQTT Broker: localhost:8883 (MQTT over TLS)

### Self-contained simulation

The default Compose configuration includes an isolated simulator transport for local testing:

```bash
docker compose exec backend node scripts/simulate-hardware.js \
	--nodes=6 --readings=18 --interval=300 \
	--invalid-every=7 --signal-loss-every=5
```

This **SIMULATED** ESP32/SIM800L process uses the separate `sim_user` credential and `nodes/simulated/flood` topic. It emits marked synthetic telemetry and queues readings during simulated GSM signal loss. The backend does not persist simulated readings, issue alerts, send SMS, or recommend grid actions; it broadcasts them only to administrator WebSocket clients. Set `MQTT_SIM_PASS` to the distinct password entered for `sim_user`.

Field devices publish to `nodes/flood/<NODE_ID>` using a unique MQTT username
that exactly matches the provisioned node ID. Mosquitto's ACL maps each username
to that topic. Provision the field user's password separately; never reuse the
backend subscriber or simulator credentials. Firmware must be built with a
trusted broker CA and per-device settings in the ignored `firmware/secrets.h`
file (see `firmware/secrets.example.h`). Without valid settings, the firmware
fails closed and will not connect.

Simulation telemetry is explicitly marked and isolated from persisted field readings, alerts, notifications, and grid recommendations. Synthetic node, subscriber, and equipment records are kept in `db/dev-seed/` and must only be loaded into a disposable development database.

The generated certificates under `mosquitto/certs` are **development-only certificates signed by a local CA**. The CA private key is kept under the ignored `.dev-certs/` directory and is not mounted into Mosquitto. Replace the CA/server certificate and key with organization-issued certificates, use secret management, and review broker ACLs before production deployment. To use a real SMS provider, set `SMS_PROVIDER=twilio` or `SMS_PROVIDER=http_gateway` and provide the corresponding credentials; no application code change is required.

### Production Deployment

Production deployment is **not ready**. The Compose stack and generated
certificates are for local development; production secrets, network policy,
database migration, backup/restore, monitoring, rollback, and deployment
approval have not been verified. See [docs/OPERATIONS.md](./docs/OPERATIONS.md)
for release gates and known limitations.

## Project Structure

```
flood-monitoring-system/
├── backend/              # Node.js/Express API + MQTT client
│   ├── app.js           # Main server, MQTT handler
│   ├── routes/          # API endpoints
│   ├── utils/           # Helper functions
│   └── Dockerfile
├── react-dashboard/     # React frontend dashboard
│   ├── src/             # React components
│   ├── nginx.conf       # Production web server config
│   └── Dockerfile       # Multi-stage production build
├── db/
│   ├── init/            # Database schema (SQL)
│   └── migrations/      # Migrations (ALTER TABLE, etc.)
├── mosquitto/           # MQTT broker config
├── firmware/            # Arduino/ESP32 firmware (node.ino)
├── docker-compose.yml   # Development compose
├── docker-compose.prod.yml  # Production compose
└── DEPLOYMENT.md        # Production deployment guide
```

## Database Schema

- `readings` - Raw sensor data from MQTT
- `alerts` - Alert records (WARNING, CRITICAL)
- `nodes` - Sensor node metadata (location, coordinates)
- `users` - User accounts (admin, operator)
- `alert_events` - Alert event history
- `grid_equipment` - Power grid equipment (location, status, recommended flag)
- `audit_logs` - Action audit trail

## API Endpoints

## Security Remediation

- Roles are constrained to `admin`, `operator`, and `resident`; legacy `viewer` rows are migrated to `resident` by `db/init/017_enforce_roles.sql`.
- WebSocket upgrades require a JWT and are server-scoped: administrators receive all events, operators receive their assigned node scope, and residents receive subscribed-node events only.
- `GET /nodes` and `GET /resident/status` require authenticated roles. Resident status is derived from the authenticated resident username, which must match its subscriber phone.
- Profile updates reject fields outside the caller's role allowlist. Alert event logging is restricted to administrators/operators, validates alert existence, and accepts only notification/sound events.
- Cutoff recommendation is available to Administrators and Operators. No role can physically switch power because the existing grid operation is recommendation-only.
- Thresholds are Administrator-editable and Operator-readable. Alert resolution/suppression and high-risk administrator changes require a reason and are audited.
- Account lifecycle changes, including role changes, password reset, and deactivation, are Administrator-only and audited.

The simulator endpoint records an auditable request; it does not claim to execute the hardware simulator itself. Accuracy is reported as unavailable until a labelled ground-truth dataset exists. Foreign-key constraints for readings and alerts are marked `NOT VALID` to preserve existing historical rows while enforcing relationships for new writes.

### Administrator Control Center

All endpoints below require `Authorization: Bearer <JWT>` and `role=admin`; operators and residents receive `403 Forbidden`.

- `GET /admin/control-center/overview` - Aggregated live health, nodes, readings, alerts, SMS deliveries, grid equipment, users, settings, and audit history
- `PUT /admin/control-center/thresholds` - Persist and apply warning/critical water-level thresholds
- `PATCH /admin/control-center/nodes/:id` - Enable or disable a sensor node
- `POST /admin/control-center/deliveries/:id/retry` - Queue a failed SMS delivery for the retry worker
- `POST /admin/control-center/subscribers` / `PATCH|DELETE /admin/control-center/subscribers/:id` - Manage notification recipients
- `PATCH /admin/control-center/equipment/:id` - Override grid status and annotation
- `POST /admin/control-center/simulations` - Record and broadcast a telemetry simulation request

### Administrator Coverage Matrix

| System function | Admin can view | Admin can control/action | Real-time |
| --- | --- | --- | --- |
| Sensor nodes | Latest/historical readings, health, battery, status, coordinates | Enable/disable node, manage node metadata through Nodes | Yes: WebSocket plus 15-second refresh |
| Communication pipeline | MQTT configuration, SMS provider, per-recipient delivery/retry history | Queue failed SMS for resend; trigger simulation request | Yes: WebSocket plus refresh |
| Data and logic | Raw readings, threshold settings, breach history | Change warning/critical thresholds; changes apply to MQTT evaluation | Readings live; settings on save |
| Alerting | Alert history, acknowledgement state, recipient list | Add, activate/deactivate, remove recipients; resend failed delivery | Alerts and delivery refresh live |
| Grid visualization | Full equipment map, status, coordinates, annotations | Override status and annotation | Equipment refresh; WebSocket recommendations |
| System performance/health | API/database/MQTT/SMS health and activity audit | Trigger telemetry simulation; inspect audit trail | Health refreshed every 15 seconds |
| Access and accountability | User accounts, roles, last login, all admin actions | Create/remove accounts and audit every control action | Audit refresh |

Every administrator mutation writes `audit_logs` with actor, action, timestamp, and notes. Physical transformer switching is not feasible in this deployment because the system is recommendation-only; the admin center provides status override, annotation, and cutoff-recommendation visibility instead of pretending to control a power relay.

### Monitoring

- `GET /health` - Health check
- `GET /history?node=NODE_ID` - Historical readings

### Grid Equipment

- `GET /grid` - List all equipment
- `POST /grid/:id/cutoff` - Recommend cutoff for equipment

### Audit

- `GET /audit` - All audit logs
- `GET /audit/filter` - Filter logs by date/operator/action
- `GET /audit/export/csv` - Export audit logs

### Alerts

- `GET /alerts/daily` - Daily alert summary
- `GET /alerts/weekly` - Weekly alert summary

## Environment Variables

See `.env.example` for development configuration and
[docs/OPERATIONS.md](./docs/OPERATIONS.md) for release gates. Replace every
placeholder before starting services. Set `MQTT_PASS` to the password
provisioned in the local Mosquitto password file. The `.env` file and broker
credential database are local-only; rotate credentials previously committed
to Git.

```bash
# Database
DATABASE_URL=REPLACE_WITH_LOCAL_VALUE

# MQTT
MQTT_BROKER=mqtt://broker_host
MQTT_USER=user
MQTT_PASS=REPLACE_WITH_A_UNIQUE_SECRET

# SMS Alerts
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=+123456789

# Auth
JWT_SECRET=REPLACE_WITH_AT_LEAST_32_RANDOM_BYTES
```

## Technology Stack

**Backend:**

- Node.js + Express
- PostgreSQL + PostGIS (geolocation)
- MQTT (Eclipse Mosquitto)
- JWT authentication
- WebSockets (real-time updates)

**Frontend:**

- React 18
- Leaflet + Marker Cluster (maps)
- Chart.js + Recharts (analytics)
- Axios (HTTP client)
- MQTT client (live updates)

**Infrastructure:**

- Docker + Docker Compose
- DigitalOcean App Platform
- Nginx (production reverse proxy)

## Development

### Running Tests

```bash
# Backend
cd backend && npm test

# Frontend
cd react-dashboard && npm test
```

### Database Migrations

```bash
# New migration
cat > db/init/008_your_migration.sql

# Run all migrations
docker-compose up db
```

## Production

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for:

- GitHub Student Pack setup ($50-100 free credits)
- DigitalOcean deployment step-by-step
- Database setup & backups
- Domain configuration
- SSL/HTTPS setup
- Monitoring & alerting
- Cost breakdown

## Monitoring & Maintenance

### Logs

```bash
docker logs flood_backend
docker logs flood_frontend
docker logs flood_mqtt
```

### Database Backup

```bash
pg_dump postgresql://user:pass@host/db | gzip > backup.sql.gz
```

### Performance Tuning

- Use connection pooling for database
- Enable gzip compression
- Cache static assets (1 year TTL)
- Use CDN for frontend (optional)

## Troubleshooting

**MQTT connection refused:**

- Check broker is running: `docker ps | grep mosquitto`
- Verify credentials in `.env`
- Check network connectivity

**Database connection failed:**

- Verify DATABASE_URL format
- Check database is running: `docker ps | grep postgres`
- Ensure firewall allows connection

**Frontend not loading:**

- Check backend API is running: `curl http://localhost:3000/health`
- Verify WebSocket proxy config in nginx.conf
- Check browser console for errors

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/name`)
3. Commit changes (`git commit -am 'Add feature'`)
4. Push to branch (`git push origin feature/name`)
5. Create Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues or questions:

1. Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment questions
2. Review logs: `docker-compose logs service_name`
3. Create an issue in GitHub with logs and error details
