# 🚀 Quick Deploy to Render

## Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Deploy to Render"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Step 2: Create Database on Render

1. Go to https://dashboard.render.com
2. **New +** → **PostgreSQL**
3. Name: `slack-stats-db`
4. Click **Create Database**
5. **Copy the Internal Database URL**

## Step 3: Create Web Service

1. **New +** → **Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Name**: `slack-stats-service`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`

## Step 4: Add Environment Variables

In Render Dashboard → Your Service → Environment:

```
NODE_ENV=production
PORT=10000
DATABASE_URL=<paste-internal-database-url>
SLACK_BOT_TOKEN=xoxb-9884255800706-9916027461335-kHabqUrpNDHHR1hiWukW1wWA
SLACK_SIGNING_SECRET=b1835f38c2d1d5e40a51106359c9ff4e
SLACK_CHANNEL_ID=C09SUH2KHK2
CRON_SCHEDULE=0 17 * * *
CRON_TIMEZONE=Asia/Kolkata
```

## Step 5: Update Slack

1. Get your Render URL: `https://your-service.onrender.com`
2. Go to https://api.slack.com/apps → Your App
3. **Event Subscriptions** → Update Request URL:
   ```
   https://your-service.onrender.com/api/slack/events
   ```
4. Wait for verification ✅
5. Save changes

## Step 6: Test

```bash
# Health check
curl https://your-service.onrender.com/health

# Test summary
curl -X POST https://your-service.onrender.com/api/slack/run-summary \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-11-17"}'
```

## Done! 🎉

Your service is now live on Render. Check your Slack channel for the summary!

