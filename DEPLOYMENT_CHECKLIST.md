# ✅ Render Deployment Checklist

## Pre-Deployment

- [ ] Code pushed to GitHub repository
- [ ] `.env` file is in `.gitignore` (not committed)
- [ ] All dependencies listed in `package.json`
- [ ] `package.json` has correct `start` script

## Render Setup

### PostgreSQL Database
- [ ] Created PostgreSQL database on Render
- [ ] Saved Internal Database URL
- [ ] Saved database credentials (host, port, user, password)

### Web Service
- [ ] Created Web Service on Render
- [ ] Connected GitHub repository
- [ ] Set build command: `npm install`
- [ ] Set start command: `npm start`
- [ ] Set root directory: (leave empty)

## Environment Variables

Add all these in Render Dashboard → Your Service → Environment:

### Required:
- [ ] `NODE_ENV=production`
- [ ] `PORT=10000`
- [ ] `SLACK_BOT_TOKEN=xoxb-...`
- [ ] `SLACK_SIGNING_SECRET=...`
- [ ] `SLACK_CHANNEL_ID=C09SUH2KHK2`

### Database (choose one method):

**Method 1: Use Internal Database URL (Recommended)**
- [ ] `DATABASE_URL=<internal-url-from-render>`

**Method 2: Individual variables**
- [ ] `DB_HOST=<host>`
- [ ] `DB_PORT=5432`
- [ ] `DB_NAME=slack_dev_db`
- [ ] `DB_USER=slack_user`
- [ ] `DB_PASSWORD=<password>`
- [ ] `DB_SSL=true`

### Optional:
- [ ] `CRON_SCHEDULE=0 17 * * *` (5 PM daily)
- [ ] `CRON_TIMEZONE=Asia/Kolkata`

## Post-Deployment

### Service Health
- [ ] Service status is "Live" (green)
- [ ] Health check works: `GET /health`
- [ ] No errors in logs

### Database
- [ ] Database connection successful (check logs)
- [ ] Tables created automatically (check via psql)
- [ ] Can query tables successfully

### Slack Integration
- [ ] Updated Request URL in Slack app to Render URL
- [ ] URL verification successful (green checkmark)
- [ ] Test message sent and received
- [ ] Events being stored in database

### Testing
- [ ] Manual summary endpoint works: `POST /api/slack/run-summary`
- [ ] Summary posted to Slack channel
- [ ] All metrics showing correctly (messages, reactions, files, members)
- [ ] Scheduler running (check logs at scheduled time)

## Monitoring

- [ ] Service logs accessible
- [ ] Database logs accessible
- [ ] Set up alerts (optional)
- [ ] Monitor service uptime

## Free Plan Considerations

If using Render Free Plan:
- [ ] Service will sleep after 15 min inactivity
- [ ] First request after sleep takes ~30 seconds
- [ ] Consider setting up ping service to keep alive
- [ ] Or upgrade to paid plan ($7/month) for 24/7 uptime

## Quick Test Commands

After deployment, test with:

```bash
# Health check
curl https://your-service.onrender.com/health

# Manual summary
curl -X POST https://your-service.onrender.com/api/slack/run-summary \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-11-17"}'
```

## Troubleshooting

If service won't start:
1. Check logs for errors
2. Verify all environment variables are set
3. Check database connection
4. Verify PORT is set to 10000

If events not received:
1. Verify Slack Request URL is correct
2. Check service is not sleeping
3. Verify URL verification is successful
4. Check Render logs for incoming requests

## Support Resources

- Render Docs: https://render.com/docs
- Render Status: https://status.render.com
- Slack API Docs: https://api.slack.com

