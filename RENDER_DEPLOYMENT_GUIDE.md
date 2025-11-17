# 🚀 Render Deployment Guide

Complete guide to deploy your Slack Stats Service to Render.

## Prerequisites

1. GitHub account (to connect your repository)
2. Render account (sign up at https://render.com)
3. Your code pushed to a GitHub repository

## Step 1: Prepare Your Repository

### 1.1 Push Code to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Slack stats service"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 1.2 Create .gitignore (if not exists)

Make sure `.env` is in `.gitignore`:
```
node_modules/
.env
*.log
.DS_Store
```

## Step 2: Create PostgreSQL Database on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `slack-stats-db`
   - **Database**: `slack_dev_db`
   - **User**: `slack_user`
   - **Plan**: Free (or paid if needed)
4. Click **"Create Database"**
5. **Save the connection details** - you'll need:
   - Internal Database URL
   - Host, Port, Database, User, Password

## Step 3: Create Web Service on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:

### Basic Settings:
- **Name**: `slack-stats-service`
- **Environment**: `Node`
- **Region**: Choose closest to you
- **Branch**: `main`
- **Root Directory**: (leave empty)
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### Environment Variables:

Add these in the Render dashboard:

#### Required:
```
NODE_ENV=production
PORT=10000
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_CHANNEL_ID=C09SUH2KHK2
CRON_SCHEDULE=0 17 * * *
CRON_TIMEZONE=Asia/Kolkata
```

#### Database (from PostgreSQL service):
```
DB_HOST=<internal-database-host>
DB_PORT=5432
DB_NAME=slack_dev_db
DB_USER=slack_user
DB_PASSWORD=<database-password>
```

**OR use Internal Database URL:**
```
DATABASE_URL=<internal-database-url-from-render>
```

### Advanced Settings:
- **Auto-Deploy**: Yes (deploys on every push)
- **Health Check Path**: `/health`

5. Click **"Create Web Service"**

## Step 4: Update Slack Event Subscription URL

Once your service is deployed:

1. Get your Render service URL (e.g., `https://slack-stats-service.onrender.com`)
2. Go to https://api.slack.com/apps → Your App
3. Click **"Event Subscriptions"**
4. Update **Request URL** to:
   ```
   https://your-service-name.onrender.com/api/slack/events
   ```
5. Slack will verify the URL automatically
6. Click **"Save Changes"**

## Step 5: Verify Deployment

### Check Service Health:
```bash
curl https://your-service-name.onrender.com/health
```

Should return:
```json
{"status":"ok","message":"Slack stats service running."}
```

### Test Manual Summary:
```bash
curl -X POST https://your-service-name.onrender.com/api/slack/run-summary \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-11-17"}'
```

### Check Logs:
1. Go to Render Dashboard → Your Service
2. Click **"Logs"** tab
3. You should see:
   - Server starting
   - Database connection successful
   - Scheduler initialized

## Step 6: Database Migration

The database tables will be created automatically on first start (via `initDb()`).

To verify:
1. Go to Render Dashboard → PostgreSQL service
2. Click **"Connect"** → **"psql"**
3. Run:
   ```sql
   \dt
   SELECT COUNT(*) FROM message_events;
   ```

## Troubleshooting

### Service Won't Start

**Check logs for:**
- Database connection errors → Verify DB credentials
- Port binding errors → Ensure PORT=10000
- Missing environment variables → Check all required vars are set

### Events Not Being Received

1. **Verify Request URL** in Slack app settings
2. **Check service is running** (not sleeping on free plan)
3. **Check Render logs** for incoming requests
4. **Verify ngrok is NOT needed** (Render provides HTTPS)

### Database Connection Issues

**On Render, use Internal Database URL:**
- Render provides an internal URL for database connections
- Use `DATABASE_URL` environment variable instead of individual DB_* vars
- Internal URL format: `postgresql://user:pass@host:5432/dbname`

### Free Plan Limitations

**Render Free Plan:**
- Services sleep after 15 minutes of inactivity
- First request after sleep takes ~30 seconds
- Consider upgrading to paid plan for 24/7 uptime

**Solution for Free Plan:**
- Use a cron service (like cron-job.org) to ping `/health` every 10 minutes
- Or upgrade to paid plan ($7/month)

## Environment Variables Reference

### Required:
| Variable | Description | Example |
|----------|-------------|---------|
| `SLACK_BOT_TOKEN` | Bot User OAuth Token | `xoxb-...` |
| `SLACK_SIGNING_SECRET` | App Signing Secret | `abc123...` |
| `SLACK_CHANNEL_ID` | Channel to track | `C09SUH2KHK2` |
| `DB_HOST` | Database host | `dpg-xxx.oregon-postgres.render.com` |
| `DB_PASSWORD` | Database password | `...` |

### Optional:
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port (use `10000` on Render) |
| `CRON_SCHEDULE` | `0 10 * * *` | Cron schedule (5 PM = `0 17 * * *`) |
| `CRON_TIMEZONE` | `UTC` | Timezone for scheduler |
| `DB_PORT` | `5432` | Database port |
| `DB_NAME` | `slack_dev_db` | Database name |
| `DB_USER` | `slack_user` | Database user |

## Post-Deployment Checklist

- [ ] Service is running (green status in Render)
- [ ] Health check returns OK
- [ ] Database tables created (check via psql)
- [ ] Slack Request URL updated to Render URL
- [ ] Slack URL verification successful
- [ ] Test message sent and stored in database
- [ ] Manual summary test successful
- [ ] Scheduler running (check logs at scheduled time)

## Monitoring

### Render Dashboard:
- **Metrics**: CPU, Memory usage
- **Logs**: Real-time application logs
- **Events**: Deployments, restarts

### Application Logs:
Check for:
- `🚀 Server listening on http://localhost:10000`
- `📆 Scheduler initialized`
- `📥 Received event: message` (when messages arrive)
- `✅ Message event saved` (when stored)

## Next Steps

1. **Set up monitoring** (optional)
2. **Configure alerts** for service downtime
3. **Set up backup** for PostgreSQL database
4. **Consider upgrading** to paid plan for 24/7 uptime

## Support

If you encounter issues:
1. Check Render logs
2. Check Slack Event Logs (api.slack.com)
3. Verify all environment variables are set
4. Test database connection separately

