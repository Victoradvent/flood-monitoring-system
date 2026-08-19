# Flood Monitoring System

A real-time flood monitoring and grid equipment control system with automatic hazard detection and cutoff recommendations.

*Features:
Real-time water level monitoring via MQTT
Automatic critical hazard detection
Grid equipment cutoff recommendations (no actual power cutoff)
SMS alerts (Twilio integration)
Web dashboard with live updates
Audit logging for all actions
Role-based access control (Admin, Operator)
Historical data & trending analysis

## Quick Start

### Local Development
```bash
# Install dependencies
cd backend && npm install
cd ../react-dashboard && npm install

# Set up environment
cp .env.example .env.local

# Start with Docker
docker-compose up build
```

**Access:**
- Frontend: http://localhost:8080
- Backend API: http://localhost:3000
- MQTT Broker: localhost:1883

### Production Deployment

**Choose your deployment platform:**

#### Option A: DigitalOcean (Easiest - 5 min)
- Free via GitHub Student Developer Pack ($50-100 credits)
- Visual dashboard, click-to-deploy
- Best for: Quick deployment, beginners
- Cost: FREE for 1-2 years, ~$20-30/mo after
- **See [QUICKSTART.md](./QUICKSTART.md)** for quick setup
- **See [DEPLOYMENT.md](./DEPLOYMENT.md)** for complete guide

#### Option B: Oracle Cloud (Best Value - 30 min)
- Truly FREE forever (always-free tier, no expiration)
- Linux VM + PostgreSQL database included
- Best for: Long-term hosting, learning, cost-conscious
- Cost: $0 forever (no credit card required)
- **See [QUICKSTART_ORACLE.md](./QUICKSTART_ORACLE.md)** for quick setup
- **See [DEPLOYMENT_ORACLE.md](./DEPLOYMENT_ORACLE.md)** for complete guide

**Not sure which one?** See [DEPLOYMENT_COMPARISON.md](./DEPLOYMENT_COMPARISON.md) for side-by-side comparison.

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

See `.env.example` for complete list. Key variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# MQTT
MQTT_BROKER=mqtt://broker_host
MQTT_USER=user
MQTT_PASS=password

# SMS Alerts
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=+123456789

# Auth
JWT_SECRET=your_secret_key
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
