# Oracle Cloud Always-Free: Quick Deployment (30 min)

## 🎯 Why Oracle Cloud?

- **FREE forever** (truly no expiration)
- No credit card required (always-free tier only)
- 2x VMs + PostgreSQL database included
- Sufficient for your final year project + beyond

---

## ⚡ 30-Minute Setup

### Step 1: Create Oracle Account (5 min)
1. Go to **[oracle.com/cloud/free](https://www.oracle.com/cloud/free/)**
2. Click **"Start for Free"**
3. Choose **"Always Free Cloud Promotion"** (not paid trial)
4. Complete signup - **NO CREDIT CARD REQUIRED**

### Step 2: Create Database (5 min)
1. **Databases** → **Autonomous Database** → **Create**
2. Database name: `flooddb`
3. Workload: **Transaction Processing**
4. Deployment: **Shared Infrastructure** (always-free)
5. Set admin password (save it!)
6. License: **Always Free**
7. Click **Create** (wait 3-5 min)

### Step 3: Create VM (5 min)
1. **Compute** → **Instances** → **Create**
2. Name: `flood-backend`
3. Image: **Ubuntu 22.04**
4. Shape: **VM.Standard.E2.1.Micro** (free tier)
5. Download SSH key (save it!)
6. Click **Create** (wait 2-3 min)

### Step 4: Deploy (15 min)

**SSH into VM:**
```bash
chmod 600 flood-backend_key.key
ssh -i flood-backend_key.key ubuntu@YOUR_PUBLIC_IP
```

**Install Docker & Docker Compose:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

**Deploy Your Project:**
```bash
git clone https://github.com/YOUR_USERNAME/flood-monitoring-system.git
cd flood-monitoring-system

# Create .env.production with your Oracle DB credentials
nano .env.production
# Paste your database connection details

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose ps
```

### Done! 🚀
- **Frontend**: `http://YOUR_VM_PUBLIC_IP:80`
- **Backend**: `http://YOUR_VM_PUBLIC_IP:3000`
- **Cost**: $0 forever
- **Duration**: Unlimited

---

## 📋 What You Need

1. Oracle Cloud Account (free)
2. SSH key from step 3
3. Database password from step 2
4. Your GitHub repository pushed
5. That's it!

---

## 🔗 Full Guide

See **[DEPLOYMENT_ORACLE.md](./DEPLOYMENT_ORACLE.md)** for:
- Detailed database setup
- Firewall configuration
- Domain setup
- SSL/HTTPS
- Troubleshooting
- Monitoring & backups
- Persistent storage

---

## 💰 Costs

| Item | Cost | Duration |
|------|------|----------|
| VM (1 GB RAM) | FREE | Forever |
| PostgreSQL | FREE | Forever |
| Storage | FREE | Forever |
| **Total** | **$0** | **Forever** |

---

## ❓ Need Help?

1. Check **[DEPLOYMENT_ORACLE.md](./DEPLOYMENT_ORACLE.md)** (full guide)
2. Run `docker-compose logs -f` to see what's happening
3. SSH into VM and debug manually

---

**Your project is now FREE for life! 🎓**
