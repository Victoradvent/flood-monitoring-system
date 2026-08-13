# Pre-Deployment Checklist

Use this checklist before deploying to either DigitalOcean or Oracle Cloud.

---

## 📋 Code Quality Checks

### Backend
- [ ] `npm install` completes without errors
- [ ] No hardcoded passwords in `.js` files
- [ ] `.env` example file updated with all required variables
- [ ] `app.js` has proper error handling
- [ ] Database connections use environment variables
- [ ] MQTT connection has timeout/retry logic

### Frontend
- [ ] `npm install` completes without errors
- [ ] React build works: `npm run build`
- [ ] No console errors in browser
- [ ] API endpoints use `process.env.REACT_APP_API_URL` (or default)
- [ ] WebSocket connects to correct backend
- [ ] Dashboard displays mock data if backend is down

### Database
- [ ] All SQL files in `db/init/` are valid
- [ ] Migration file `007_add_recommended_to_grid_equipment.sql` included
- [ ] No duplicate table definitions
- [ ] Foreign keys are properly defined

### Docker
- [ ] `docker-compose build` completes without errors
- [ ] `docker-compose up` starts all services
- [ ] `docker-compose logs` shows no critical errors
- [ ] Health checks pass: `docker-compose ps`

---

## 🔒 Security Checks

### Environment Variables
- [ ] `.env` file is in `.gitignore`
- [ ] No passwords in README or comments
- [ ] `.env.example` has placeholder values only
- [ ] Production `.env` has strong passwords (32+ chars)
- [ ] JWT_SECRET is cryptographically random

### Code Security
- [ ] No SQL injection vulnerabilities (use parameterized queries)
- [ ] No hardcoded API keys or tokens
- [ ] CORS is configured for specific origins (not `*`)
- [ ] Authentication middleware on all protected endpoints
- [ ] Password hashing uses bcrypt (not plain text)

### Network
- [ ] Database password is complex (12+ chars, mixed case, numbers, symbols)
- [ ] MQTT broker has authentication enabled
- [ ] Firewall rules are restrictive (whitelist, not blacklist)
- [ ] SSH keys are properly secured (600 permissions)

---

## 📦 Deployment Files

### Git Repository
- [ ] Repository is public (or private if preferred)
- [ ] All source code is committed
- [ ] `.gitignore` includes: `node_modules/`, `.env`, `*.log`, etc.
- [ ] No large binary files (>10 MB)
- [ ] README.md is up to date
- [ ] License file exists

### Dockerfiles
- [ ] `backend/Dockerfile` exists and builds
- [ ] `react-dashboard/Dockerfile` exists and builds
- [ ] Dockerfiles use `FROM node:18-alpine` (or specified base)
- [ ] Health checks are defined
- [ ] No `RUN npm install` with root user

### Docker Compose
- [ ] `docker-compose.yml` works locally
- [ ] `docker-compose.prod.yml` is optimized for production
- [ ] Service names don't conflict with other projects
- [ ] Networks are properly configured
- [ ] Volumes are defined for persistent data

### Configuration
- [ ] `.env.example` file exists with all required variables
- [ ] `nginx.conf` exists for frontend serving
- [ ] `mosquitto/mosquitto.conf` has proper auth setup
- [ ] Database initialization scripts are in `db/init/`

---

## 🧪 Functional Tests

### Backend
- [ ] `POST /login` works with correct credentials
- [ ] `GET /health` returns 200
- [ ] `GET /grid` returns equipment list
- [ ] `POST /grid/:id/cutoff` works and broadcasts message
- [ ] WebSocket connections can be established
- [ ] Error responses have proper HTTP status codes

### Frontend
- [ ] Login page loads
- [ ] Can log in with test credentials
- [ ] Dashboard displays without errors
- [ ] GridPanel component renders
- [ ] AuditPanel shows audit logs
- [ ] WebSocket notifications appear

### Database
- [ ] Can connect with provided credentials
- [ ] All tables exist: `readings`, `alerts`, `nodes`, `users`, `grid_equipment`, `audit_logs`
- [ ] Sample data can be inserted
- [ ] Queries execute without errors

### MQTT
- [ ] Mosquitto broker is running
- [ ] Can publish test message: `mosquitto_pub -t test -m hello`
- [ ] Can subscribe to messages
- [ ] Authentication works (if configured)

---

## ✅ Pre-Production Checklist

### DigitalOcean Specific
- [ ] GitHub Student Pack claim email received
- [ ] DigitalOcean account created
- [ ] Credits shown in account ($50+ available)
- [ ] PostgreSQL database created
- [ ] Database connection details saved
- [ ] Repository pushed to GitHub
- [ ] `.env.production` file prepared

### Oracle Cloud Specific
- [ ] Oracle Cloud always-free account created
- [ ] Autonomous Database created (PostgreSQL)
- [ ] VM instance created (Ubuntu 22.04)
- [ ] SSH key downloaded and saved safely
- [ ] VM public IP obtained
- [ ] Database connection details saved
- [ ] Repository pushed to GitHub

---

## 📊 Performance Checks

- [ ] Backend response time < 500ms for `/grid` endpoint
- [ ] Dashboard loads in < 3 seconds
- [ ] No memory leaks in backend (check with `docker stats`)
- [ ] No console errors in browser DevTools
- [ ] WebSocket latency < 100ms for local testing

---

## 📈 Monitoring & Logging

- [ ] Backend logs are configured (not too verbose)
- [ ] Application errors go to stderr
- [ ] MQTT connection attempts are logged
- [ ] Database queries can be monitored
- [ ] Health checks run regularly

---

## 🎯 Final Checks (Before Deploying)

- [ ] Git repository has no uncommitted changes: `git status`
- [ ] Latest commit is pushed to GitHub: `git log -1`
- [ ] `.env.production` file is prepared (NOT in git)
- [ ] All environment variables documented in `.env.example`
- [ ] Docker images build without warnings: `docker-compose build`
- [ ] All services start without errors: `docker-compose up`
- [ ] No exposed passwords or keys in commit history
- [ ] README.md has complete deployment instructions
- [ ] You have backups of all `.env` files (store securely)

---

## 📝 Deployment Readiness Sign-Off

- [ ] All checks above are complete
- [ ] I understand the deployment platform (DigitalOcean or Oracle Cloud)
- [ ] I have backup copies of passwords and SSH keys
- [ ] I have read the appropriate deployment guide (DEPLOYMENT.md or DEPLOYMENT_ORACLE.md)
- [ ] I'm ready to deploy

**Ready to deploy!** 🚀

---

## During Deployment

### DigitalOcean
1. Follow [QUICKSTART.md](./QUICKSTART.md) (5 min)
2. Or detailed [DEPLOYMENT.md](./DEPLOYMENT.md) for full control

### Oracle Cloud
1. Follow [QUICKSTART_ORACLE.md](./QUICKSTART_ORACLE.md) (30 min)
2. Or detailed [DEPLOYMENT_ORACLE.md](./DEPLOYMENT_ORACLE.md) for full control

---

## After Deployment

- [ ] Application is accessible from browser
- [ ] Backend health check passes: `/health`
- [ ] Database is connected and queries work
- [ ] WebSocket connections are active
- [ ] Monitoring/logging is enabled
- [ ] Backup strategy is in place
- [ ] Domain is configured (if using custom domain)
- [ ] SSL certificate is active (if using HTTPS)

---

## Troubleshooting

If something fails:
1. Check application logs: `docker-compose logs [service]`
2. Test connectivity to database: `psql [connection_string]`
3. Verify `.env` variables are correct
4. Check firewall rules allow traffic
5. Review deployment guide's troubleshooting section

---

**Great job preparing your project for production! 🎓**
