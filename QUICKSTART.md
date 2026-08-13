# Quick Start: Deploy to DigitalOcean (Free for Students)

## ⚡ 5-Minute Setup

### Step 1: Get Free Credits (5 min)
1. Go to **[education.github.com](https://education.github.com)**
2. Verify with your **.edu email**
3. Claim **$50-100 DigitalOcean credits**

### Step 2: Create DigitalOcean Account (2 min)
1. Sign up at **[digitalocean.com](https://www.digitalocean.com)**
2. Redeem your credits
3. Create **PostgreSQL 15** database ($15/mo - covered by credits)

### Step 3: Deploy Your Project (3 min)
1. Push your code to **GitHub**
2. Go to **DigitalOcean Apps** → **Create App**
3. Connect GitHub repository
4. Add `.env.production` variables (see DEPLOYMENT.md)
5. Click **Deploy**

### Done! 🎉
- Frontend: `https://your-app.ondigitalocean.app`
- Backend: `https://your-app.ondigitalocean.app/health`
- Database: Managed PostgreSQL with backups

---

## 📋 Checklist Before Deployment

- [ ] GitHub Student Pack approved (5-30 min wait)
- [ ] DigitalOcean account created
- [ ] PostgreSQL database created
- [ ] `.env.production` file filled with DB credentials
- [ ] Code pushed to GitHub
- [ ] Docker builds work locally (`docker-compose build`)

---

## 🔧 Prepare Your Project

### 1. Create `.env.production`
```bash
DATABASE_URL=postgresql://doadmin:PASSWORD@xxxxx.db.ondigitalocean.com:25060/defaultdb?sslmode=require
MQTT_BROKER=mqtt
MQTT_PORT=1883
JWT_SECRET=<generate with: openssl rand -base64 32>
```

### 2. Push to GitHub
```bash
git add .
git commit -m "Production ready"
git push origin main
```

### 3. DigitalOcean Dashboard
1. Apps → Create App
2. Select your GitHub repo
3. Configure services (auto-detected)
4. Set environment variables
5. Deploy

---

## 💰 Cost Breakdown

| Item | Cost | Duration |
|------|------|----------|
| GitHub Student Pack | Free | 1 year |
| DigitalOcean credits | $50-100 | 1-2 years |
| **Total** | **$0** | **Until graduation** |

After free credits expire:
- Basic setup: ~$20-30/month
- Can upgrade/downgrade anytime

---

## 📖 Full Documentation

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for:
- Detailed step-by-step guide
- Database setup & migrations
- Domain configuration
- SSL/HTTPS setup
- Backup strategy
- Troubleshooting
- Monitoring setup

---

## ❓ Questions?

1. Check DEPLOYMENT.md (detailed guide)
2. Check DigitalOcean docs
3. Look at app logs in DigitalOcean dashboard
4. Run locally first: `docker-compose up`

---

## 🚀 Next Steps

1. ✅ Apply for GitHub Student Pack
2. ✅ Wait for approval (check email)
3. ✅ Follow Step 1-3 above
4. ✅ Your project is live!

**Good luck! 🎓**
