# Oracle Cloud Always-Free Deployment Guide

## Why Oracle Cloud Always-Free?

- **✅ Truly FREE forever** (no expiration, no credit card required for always-free tier)
- **✅ Includes**: 2x VMs (1GB RAM each) + Managed PostgreSQL Database
- **✅ 200 GB storage** (enough for your entire project)
- **✅ 10 GB/month outbound bandwidth**
- **✅ No credit card needed** (for always-free resources only)
- **❌ Tradeoff**: Slightly more setup than DigitalOcean, but unlimited duration

---

## Step 1: Create Oracle Cloud Account

### 1.1 Sign Up (Free Tier - No Credit Card Required)
1. Go to **[oracle.com/cloud/free](https://www.oracle.com/cloud/free/)**
2. Click **"Start for free"**
3. Fill in account details:
   - Email
   - Full name
   - Country
4. Choose **"Always Free Cloud Promotion"** (not paid trial)
5. Complete identity verification
6. **No credit card required for always-free tier**

### 1.2 Create Compartment
Once logged in:
1. Go to **Governance** → **Compartments**
2. Click **"Create Compartment"**
3. Name: `flood-monitoring`
4. Description: `Flood monitoring project resources`
5. Click **Create**

---

## Step 2: Set Up Oracle Autonomous Database (PostgreSQL)

### 2.1 Create Database
1. Go to **Databases** → **Autonomous Database**
2. Click **"Create Autonomous Database"**
3. Choose compartment: `flood-monitoring`
4. Display name: `flood-db`
5. Database name: `flooddb`
6. Workload type: **Transaction Processing**
7. Deployment type: **Shared Infrastructure** (free tier)
8. Admin password: Choose a strong password (save it!)
9. License type: **Always Free** (should show as eligible)
10. Click **Create Database**
11. Wait 3-5 minutes for database to be ready

### 2.2 Get Database Connection Details
Once created:
1. Click on your database
2. Go to **Database Connection**
3. Download **Wallet** (contains connection certificates)
   - This is important for secure connection
4. Click **"Show"** to see connection string
5. Save these details:
   - **Host**: `xxxxx.db.xxxx.oraclecloud.com`
   - **Port**: `1521` (or `1522` for TLS)
   - **Database**: `flooddb`
   - **User**: `admin`
   - **Password**: The one you set

---

## Step 3: Set Up Compute VM (Free Tier)

### 3.1 Create VM Instance
1. Go to **Compute** → **Instances**
2. Click **"Create Instance"**
3. Configure:
   - **Name**: `flood-backend`
   - **Compartment**: `flood-monitoring`
   - **Image**: Ubuntu 22.04 (Always Free eligible)
   - **Shape**: `VM.Standard.E2.1.Micro` (free tier, 1 OCPU, 1 GB RAM)
   - **VCN**: Create new or use existing
   - **SSH Key**: Generate new keypair
     - Download and save `flood-backend_key.key` (IMPORTANT!)
4. Click **Create**
5. Wait 2-3 minutes for VM to start
6. Copy **Public IP** address (you'll need this to SSH)

### 3.2 SSH into VM
```bash
# Change permissions on SSH key
chmod 600 flood-backend_key.key

# SSH into the VM
ssh -i flood-backend_key.key ubuntu@YOUR_PUBLIC_IP

# Update system
sudo apt update && sudo apt upgrade -y
```

### 3.3 Install Docker
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group (so you don't need sudo)
sudo usermod -aG docker ubuntu

# Verify installation
docker --version
```

### 3.4 Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

### 3.5 Install Git
```bash
sudo apt install -y git
git --version
```

---

## Step 4: Deploy Your Project

### 4.1 Clone Your Repository
```bash
cd /home/ubuntu
git clone https://github.com/YOUR_USERNAME/flood-monitoring-system.git
cd flood-monitoring-system
```

### 4.2 Create Production Environment File
Create `.env.production` on the VM:

```bash
# Database (Oracle Autonomous Database)
DATABASE_URL=postgresql://admin:PASSWORD@xxxxx.db.xxxx.oraclecloud.com:1522/flooddb?sslmode=require
POSTGRES_USER=admin
POSTGRES_PASSWORD=YOUR_PASSWORD
POSTGRES_DB=flooddb
PG_HOST=xxxxx.db.xxxx.oraclecloud.com
PG_PORT=1522
PG_USER=admin
PG_PASS=YOUR_PASSWORD
PG_DB=flooddb
PGSSLMODE=require

# MQTT
MQTT_BROKER=localhost
MQTT_PORT=1883
MQTT_USER=flood_user
MQTT_PASS=STRONG_PASSWORD_HERE
MQTT_TOPIC=flood/sensors

# Auth
JWT_SECRET=$(openssl rand -base64 32)

# Server
PORT=3000
NODE_ENV=production
```

**On your local machine, create the file:**
```bash
nano .env.production
# Paste the above content
# Replace PASSWORD and PUBLIC_IP
# Save: Ctrl+X, Y, Enter
```

**Upload to VM:**
```bash
scp -i flood-backend_key.key .env.production ubuntu@YOUR_PUBLIC_IP:~/flood-monitoring-system/
```

### 4.3 Upload Database Wallet (for SSL/TLS)
Oracle requires the wallet for secure database connections:

```bash
# Create wallet directory
mkdir -p ~/flood-monitoring-system/wallet

# Upload wallet files (download from Oracle Cloud console)
scp -i flood-backend_key.key -r ~/Downloads/Wallet_flooddb/* \
  ubuntu@YOUR_PUBLIC_IP:~/flood-monitoring-system/wallet/
```

### 4.4 Build and Run Docker Containers
```bash
# SSH back into VM
ssh -i flood-backend_key.key ubuntu@YOUR_PUBLIC_IP

# Navigate to project
cd ~/flood-monitoring-system

# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose logs -f backend
```

### 4.5 Initialize Database
```bash
# Connect to Oracle Database
# Use SQL*Plus or similar tool to run SQL files

# Or use psql through the Docker container
docker-compose exec backend psql postgresql://admin:PASSWORD@oracle_host:1522/flooddb \
  -c "$(cat db/init/001_create_readings.sql)"
```

---

## Step 5: Configure Firewall & Network

### 5.1 Open Ports on VM
```bash
# SSH into VM
ssh -i flood-backend_key.key ubuntu@YOUR_PUBLIC_IP

# Configure UFW firewall
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 3000/tcp # Backend API
sudo ufw allow 1883/tcp # MQTT
sudo ufw enable

sudo ufw status
```

### 5.2 Configure Oracle Cloud Security List
1. Go to **Networking** → **Virtual Cloud Networks**
2. Select your VCN
3. Click **Security Lists**
4. Edit the security list for your subnet
5. Add **Ingress Rules**:
   - Allow port 80 (HTTP)
   - Allow port 443 (HTTPS)
   - Allow port 3000 (Backend)
   - Allow port 1883 (MQTT)

### 5.3 Allow Database Access from VM
1. Go to **Databases** → **Autonomous Database**
2. Click your database
3. Go to **Database Connection**
4. Whitelist the **VM's Private IP** or use wallet authentication

---

## Step 6: Set Up Nginx Reverse Proxy (Optional but Recommended)

### 6.1 Install Nginx
```bash
sudo apt install -y nginx

# Start nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 6.2 Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/default
```

Replace with:
```nginx
upstream backend {
    server localhost:3000;
}

upstream frontend {
    server localhost:8080;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Restart Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 7: Set Up Persistent Storage (Optional)

For data persistence across VM restarts:

### 7.1 Create Block Volume
1. Go to **Block Storage** → **Block Volumes**
2. Click **Create Block Volume**
3. Size: 100 GB (free tier allows this)
4. Attach to your VM

### 7.2 Mount Volume
```bash
# List disks
lsblk

# Create filesystem
sudo mkfs.ext4 /dev/sdb1

# Create mount point
sudo mkdir -p /mnt/data

# Mount
sudo mount /dev/sdb1 /mnt/data

# Make persistent (add to /etc/fstab)
echo '/dev/sdb1 /mnt/data ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab

# Move Docker data
sudo systemctl stop docker
sudo mv /var/lib/docker /mnt/data/
sudo ln -s /mnt/data/docker /var/lib/docker
sudo systemctl start docker
```

---

## Step 8: Set Up Domain (Optional)

### 8.1 Use Oracle Cloud DNS
1. Go to **DNS** → **Zones**
2. Create a new zone for your domain
3. Point nameservers at your registrar

### 8.2 Or Use Free Subdomain
Oracle Cloud provides free subdomains:
1. Go to **Instances**
2. Your instance → **More** → **Public IP Address**
3. Configure DDNS (Dynamic DNS) if IP changes

---

## Step 9: Monitor & Maintain

### 9.1 View Logs
```bash
# Backend logs
docker-compose logs -f backend

# MQTT logs
docker-compose logs -f mqtt

# All logs
docker-compose logs -f
```

### 9.2 Backup Database
```bash
# Export database
pg_dump postgresql://admin:PASSWORD@oracle_host:1522/flooddb | gzip > backup_$(date +%Y%m%d).sql.gz

# Download backup to local machine
scp -i flood-backend_key.key ubuntu@YOUR_PUBLIC_IP:~/backup_*.sql.gz ~/backups/
```

### 9.3 Enable Auto-Restart
```bash
# Make Docker services start on reboot
sudo systemctl enable docker

# Add to crontab for daily restarts (optional)
crontab -e
# Add: 0 3 * * * docker-compose -f /home/ubuntu/flood-monitoring-system/docker-compose.prod.yml restart
```

---

## Step 10: HTTPS with Let's Encrypt (Optional)

### 10.1 Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 10.2 Get Certificate
```bash
sudo certbot certonly --standalone -d yourdomain.com
```

### 10.3 Configure Nginx for HTTPS
Update `/etc/nginx/sites-available/default` to redirect HTTP → HTTPS and serve SSL certificates.

---

## Cost Breakdown

| Resource | Monthly Cost | Always-Free? |
|----------|-------------|------------|
| 2x Compute (1GB each) | $0 | ✅ Yes |
| Autonomous Database | $0 | ✅ Yes (shared infra) |
| Storage (100 GB block) | $0 | ✅ Yes |
| Bandwidth (10 GB/mo) | $0 | ✅ Yes |
| **Total** | **$0** | **✅ Forever** |

---

## Troubleshooting

### Can't Connect to Database
```bash
# Test connection
psql postgresql://admin:PASSWORD@oracle_host:1522/flooddb -c "SELECT 1"

# If fails, check:
# 1. Security list allows your VM's IP
# 2. Wallet is in correct location
# 3. PGSSLMODE=require is set
```

### Docker Not Starting
```bash
# Check Docker status
sudo systemctl status docker

# Restart Docker
sudo systemctl restart docker

# View logs
sudo journalctl -u docker -n 50
```

### Out of Memory
```bash
# Check resource usage
free -h
docker stats

# Increase swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Services Stop After Reboot
```bash
# Make Docker services persistent
cd ~/flood-monitoring-system
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# Add to systemd for auto-start
sudo nano /etc/systemd/system/flood-monitoring.service
```

Add:
```ini
[Unit]
Description=Flood Monitoring System
After=docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/home/ubuntu/flood-monitoring-system
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable flood-monitoring.service
sudo systemctl start flood-monitoring.service
```

---

## Performance Tips

1. **Use SSD storage** - Oracle's Always-Free VMs have SSD
2. **Enable gzip compression** - Nginx config already has it
3. **Cache static assets** - nginx.conf caches for 1 year
4. **Use connection pooling** - PostgreSQL connection pool in backend
5. **Monitor resources** - Use `docker stats` regularly

---

## Migration After Project Ends

If you want to keep this running after graduation:
- **Oracle Cloud Always-Free tier runs forever** ✅
- Can always upgrade to paid tier if needed
- Can migrate to another platform anytime

---

## Useful Commands

```bash
# SSH into VM
ssh -i flood-backend_key.key ubuntu@YOUR_PUBLIC_IP

# View running containers
docker-compose ps

# View logs
docker-compose logs -f [service_name]

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Update code
cd ~/flood-monitoring-system && git pull && docker-compose up -d --build
```

---

## Support & Documentation

- Oracle Cloud Docs: [docs.oracle.com/cloud](https://docs.oracle.com/cloud)
- Always-Free FAQ: [oracle.com/cloud/free](https://www.oracle.com/cloud/free)
- Docker Compose: [docs.docker.com/compose](https://docs.docker.com/compose)

---

**Your project is now running for FREE, FOREVER! 🎉**

Total setup time: ~30-45 minutes  
Cost: $0  
Duration: As long as you want (no expiration)
