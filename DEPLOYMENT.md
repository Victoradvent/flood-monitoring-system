# Deployment Guide: GitHub Student Pack + DigitalOcean

## Step 1: Get GitHub Student Pack ($50-100 DigitalOcean Credits)

### 1.1 Apply for GitHub Student Developer Pack
1. Go to **[education.github.com](https://education.github.com)**
2. Click **"Get benefits"** or **"Get Student Pack"**
3. Sign in with your GitHub account (or create one)
4. Verify with your **university email** (.edu, .ac.uk, etc.)
5. Upload proof (student ID, acceptance letter, etc.)
6. **Wait 5-30 minutes** for approval

### 1.2 Claim DigitalOcean Credits
Once approved:
1. Go to your **GitHub Student Pack** page
2. Find **DigitalOcean**
3. Click **"Get access"** or **"Get offer"**
4. You'll get **$50-100 in free credits** (expires in 1 year)
5. Redeem at **DigitalOcean**

---

## Step 2: Create DigitalOcean Account & Set Up

### 2.1 Sign Up
1. Go to **[digitalocean.com](https://www.digitalocean.com)**
2. Click **"Sign up"**
3. Sign up with GitHub account (recommended)
4. Add your payment method (won't charge, needed for verification)
5. Redeem your $50-100 credits from GitHub Student Pack

### 2.2 Create PostgreSQL Database
1. In DigitalOcean dashboard → **Databases** → **Create Database**
2. Choose:
   - **Engine**: PostgreSQL 15
   - **Datacenter**: Closest to you (or us-east-1)
   - **Plan**: Basic ($15/month - **covered by free credits**)
   - **Number of nodes**: 1
3. Name it: `flood-monitoring-prod`
4. Click **Create**
5. Wait 3-5 minutes for database to initialize

### 2.3 Get Database Connection Details
Once created:
1. Click on the database
2. Copy these details (you'll need them for `.env`):
   - **Host**: `xxxxx.db.ondigitalocean.com`
   - **Port**: `25060`
   - **Database**: `defaultdb`
   - **Username**: `doadmin`
   - **Password**: (click "reveal password")
   - **Connection string**: Copy this for `DATABASE_URL`

---

## Step 3: Prepare Your Project for Deployment

### 3.1 Create `.env.production` File

In your project root directory, create `.env.production`:

```bash
# Database (from DigitalOcean)
DATABASE_URL=postgresql://doadmin:PASSWORD@xxxxx.db.ondigitalocean.com:25060/defaultdb?sslmode=require
POSTGRES_USER=doadmin
POSTGRES_PASSWORD=YOUR_PASSWORD
POSTGRES_DB=defaultdb
PG_HOST=xxxxx.db.ondigitalocean.com
PG_PORT=25060
PG_USER=doadmin
PG_PASS=YOUR_PASSWORD
PG_DB=defaultdb
PGSSLMODE=require

# MQTT (use DigitalOcean's internal network)
MQTT_BROKER=mqtt
MQTT_PORT=1883
MQTT_USER=flood_user
MQTT_PASS=STRONG_PASSWORD_HERE
MQTT_TOPIC=flood/sensors

# Auth
JWT_SECRET=GENERATE_RANDOM_STRING_HERE

# SMS (optional - Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=

# SMS Gateway (optional)
SMS_GATEWAY_URL=
SMS_GATEWAY_APIKEY=
SMS_GATEWAY_FROM=

# Server
PORT=3000
NODE_ENV=production
```

**Generate random secrets:**
```bash
# On Linux/Mac/WSL
openssl rand -base64 32
```

### 3.2 Update docker-compose.yml for Production

Replace `docker-compose.yml` with production version:

```yaml
version: '3.9'

services:
  db:
    image: postgres:15
    container_name: flood_db
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - ./db/init:/docker-entrypoint-initdb.d
    # Don't use local volume for managed database
    networks:
      - floodnet

  mqtt:
    image: eclipse-mosquitto:2
    container_name: flood_mqtt
    restart: always
    volumes:
      - ./mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf
      - mosquitto_data:/mosquitto/data
    ports:
      - "1883:1883"
      - "9001:9001"
    networks:
      - floodnet

  backend:
    build: ./backend
    container_name: flood_backend
    restart: always
    env_file: .env.production
    depends_on:
      - mqtt
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
    networks:
      - floodnet

  frontend:
    build: ./react-dashboard
    container_name: flood_frontend
    restart: always
    depends_on:
      - backend
    ports:
      - "8080:80"
    networks:
      - floodnet

volumes:
  mosquitto_data:

networks:
  floodnet:
    driver: bridge
```

### 3.3 Update Dockerfiles

**backend/Dockerfile** - add production optimizations:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
```

**react-dashboard/Dockerfile** - build for production:
```dockerfile
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV REACT_APP_API_URL=https://your-domain.com
RUN npm run build

# Serve with nginx
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

Create **react-dashboard/nginx.conf**:
```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://backend:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Step 4: Deploy to DigitalOcean App Platform

### 4.1 Push to GitHub
```bash
git add .
git commit -m "Production deployment ready"
git push origin main
```

### 4.2 Create DigitalOcean App
1. In DigitalOcean dashboard → **Apps** → **Create App**
2. Choose **GitHub** as source
3. Select your repository
4. Choose branch: `main`
5. Click **Next**

### 4.3 Configure Services
1. **Dockerfile**: Should auto-detect services
2. For each service (backend, frontend, mqtt):
   - Set port mappings
   - Add environment variables
3. Click **Next**

### 4.4 Set Environment Variables
1. Click **"Edit Environment Variables"**
2. Paste all values from `.env.production`
3. For sensitive data (passwords):
   - Use DigitalOcean secrets manager
   - Or add as encrypted variables

### 4.5 Review & Deploy
1. Review configuration
2. Click **"Create Resources"**
3. Click **"Deploy App"**
4. Wait 5-10 minutes for deployment

---

## Step 5: Configure Database

Once deployed:

### 5.1 Run Database Migrations
```bash
# SSH into your app or use DigitalOcean's console
psql postgresql://doadmin:PASSWORD@xxxxx.db.ondigitalocean.com:25060/defaultdb

# Run all SQL files from db/init/
\i db/init/001_create_readings.sql
\i db/init/002_create_alerts.sql
\i db/init/003_create_nodes.sql
\i db/init/004_create_users.sql
\i db/init/005_create_alert_events.sql
\i db/init/006_create_grid_equipment.sql
\i db/init/007_add_recommended_to_grid_equipment.sql
```

### 5.2 Create Admin User
```bash
psql postgresql://doadmin:PASSWORD@xxxxx.db.ondigitalocean.com:25060/defaultdb

INSERT INTO users (username, password_hash, role) VALUES 
('admin', '$2b$10$...HASHED_PASSWORD...', 'admin');
```

---

## Step 6: Set Up Domain (Optional but Recommended)

### 6.1 Point Domain to DigitalOcean
1. Buy domain from **Namecheap**, **GoDaddy**, or **Google Domains**
2. Go to **DigitalOcean Apps** → Your App → **Settings**
3. Under **Domains**, add your domain
4. Update nameservers at domain registrar to DigitalOcean's:
   - `ns1.digitalocean.com`
   - `ns2.digitalocean.com`
   - `ns3.digitalocean.com`
5. Wait 24-48 hours for DNS propagation

### 6.2 Enable HTTPS (Automatic)
DigitalOcean automatically provisions Let's Encrypt SSL certificates.

---

## Step 7: Monitor Your Deployment

### 7.1 View Logs
1. DigitalOcean Apps dashboard → **Logs** tab
2. Filter by service (backend, frontend, mqtt)

### 7.2 Set Up Monitoring
1. DigitalOcean → **Monitoring**
2. Create alerts for:
   - High CPU/memory
   - App crashes
   - Database connection issues

### 7.3 Backup Database
```bash
# Manual backup
pg_dump postgresql://doadmin:PASSWORD@xxxxx.db.ondigitalocean.com:25060/defaultdb \
  | gzip > backup_$(date +%Y%m%d).sql.gz

# Automated daily backups
0 2 * * * pg_dump ... | gzip > backups/db_$(date +\%Y\%m\%d).sql.gz
```

---

## Step 8: Access Your Live Application

Once deployed:
- **Frontend**: `https://your-app.ondigitalocean.app` (auto-assigned)
- **Backend API**: `https://your-app.ondigitalocean.app/health`
- **WebSocket**: `wss://your-app.ondigitalocean.app` (auto-upgraded to WSS)

---

## Troubleshooting

### App won't start
1. Check **Logs** tab in DigitalOcean dashboard
2. Common issues:
   - Missing `.env` variables
   - Database connection failed → Check firewall/credentials
   - Port already in use → Change port in `docker-compose.yml`

### Database connection refused
1. Ensure database is running: DigitalOcean → **Databases**
2. Check firewall: Database → **Networking** → Allow app's IP
3. Verify `DATABASE_URL` format is correct

### High costs
1. $50-100 credits cover ~3-6 months
2. After credits expire: ~$30-50/month for your setup
3. If too expensive, switch to Oracle Cloud Always-Free

---

## Cost Breakdown

| Service | Monthly Cost | Covered by Credits? |
|---------|-------------|-------------------|
| PostgreSQL (Basic) | $15 | ✅ Yes (1 year) |
| Docker + Node.js | $5-10 | ✅ Yes |
| Bandwidth | $0-5 | ✅ Yes |
| **Total** | **$20-30/mo** | **✅ Free for 1-2 years** |

---

## Next Steps

1. ✅ Apply for GitHub Student Pack
2. ✅ Redeem DigitalOcean credits
3. ✅ Create managed PostgreSQL
4. ✅ Deploy via DigitalOcean Apps
5. ✅ Configure domain (optional)
6. ✅ Monitor and backup

**Questions?** Check DigitalOcean's documentation or create an issue in your repo.

Good luck with your final year project! 🎓
