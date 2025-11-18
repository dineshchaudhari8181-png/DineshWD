# ⏰ Scheduler Troubleshooting Guide

## Why the 10 AM Job Didn't Trigger

### Most Common Issue: Render Free Plan

**Problem:** Render free plan services **sleep after 15 minutes of inactivity**. When the service is sleeping, cron jobs **will NOT run**.

**Solution Options:**

#### Option 1: Use External Cron Service (Recommended for Free Plan)

Use a free cron service to ping your health endpoint every 10 minutes to keep the service awake:

1. **Sign up for cron-job.org** (free): https://cron-job.org
2. **Create a new cron job:**
   - URL: `https://your-service-name.onrender.com/health`
   - Schedule: Every 10 minutes
   - Method: GET
3. This will keep your service awake so cron can run

#### Option 2: Upgrade to Paid Plan

- Render paid plan ($7/month) keeps services running 24/7
- Cron jobs will work reliably

#### Option 3: Use External Cron Service to Trigger Summary

Instead of relying on internal cron, use an external service to trigger the summary:

1. **Use cron-job.org** or **EasyCron**
2. **Set up a cron job** to call:
   ```
   POST https://your-service-name.onrender.com/api/slack/run-summary
   Content-Type: application/json
   ```
3. **Schedule it** for 10 AM your timezone

---

## How to Debug

### Step 1: Check Render Logs

1. Go to Render Dashboard → Your Service → **"Logs"** tab
2. Look for these messages:

**When service starts:**
```
🕐 Current server time: 2024-01-15T10:00:00.000Z
🌍 Server timezone: UTC
⏰ Scheduled timezone: Asia/Kolkata
📅 Cron schedule: "0 10 * * *"
📆 Scheduler initialized. Summaries will post at "0 10 * * *" (Asia/Kolkata).
📆 Next scheduled run: Tomorrow at 10:00 AM Asia/Kolkata
```

**When cron triggers (at 10 AM):**
```
⏰ ========================================
⏰ Running scheduled Slack summary job...
⏰ Triggered at: 2024-01-15T04:30:00.000Z
⏰ Timezone: Asia/Kolkata
⏰ ========================================
```

**If there's an error:**
```
❌ ========================================
❌ Failed to post daily summary:
❌ Error: [error message]
❌ Stack: [stack trace]
❌ ========================================
```

### Step 2: Check Service Status

1. Go to Render Dashboard → Your Service
2. Check the **status**:
   - ✅ **"Live"** (green) = Service is running, cron should work
   - ⚠️ **"Sleeping"** (gray) = Service is asleep, cron won't run

### Step 3: Verify Environment Variables

In Render Dashboard → Your Service → **"Environment"** tab, check:

```
CRON_SCHEDULE=0 10 * * *
CRON_TIMEZONE=Asia/Kolkata
```

**Important:** 
- `CRON_SCHEDULE` format: `"minute hour day month weekday"`
- `0 10 * * *` = 10:00 AM every day
- `CRON_TIMEZONE` should match your timezone (e.g., `Asia/Kolkata` for India)

### Step 4: Test Manually

Test if the summary works manually:

```bash
curl -X POST https://your-service-name.onrender.com/api/slack/run-summary \
  -H "Content-Type: application/json"
```

If this works, the issue is with the scheduler, not the summary function.

---

## Common Issues

### Issue 1: Service is Sleeping

**Symptoms:**
- No logs at 10 AM
- Service status shows "Sleeping"

**Solution:**
- Use external cron service to ping `/health` every 10 minutes
- Or upgrade to paid plan

### Issue 2: Wrong Timezone

**Symptoms:**
- Cron runs at wrong time
- Logs show different timezone

**Solution:**
- Check `CRON_TIMEZONE` in Render environment variables
- Should be `Asia/Kolkata` for India time
- List of timezones: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

### Issue 3: Invalid Cron Schedule

**Symptoms:**
- Error in logs: `❌ ERROR: Invalid cron schedule`

**Solution:**
- Verify `CRON_SCHEDULE` format: `"minute hour day month weekday"`
- Examples:
  - `0 10 * * *` = 10:00 AM daily
  - `0 17 * * *` = 5:00 PM daily
  - `30 9 * * *` = 9:30 AM daily

### Issue 4: Service Crashed

**Symptoms:**
- Service status shows "Failed" or "Stopped"
- No logs at all

**Solution:**
1. Check Render logs for errors
2. Verify all environment variables are set
3. Check database connection
4. Restart the service

---

## Quick Fix: Keep Service Awake

### Using cron-job.org (Free)

1. **Sign up:** https://cron-job.org (free account)
2. **Create cron job:**
   - **Title:** Keep Render Service Awake
   - **URL:** `https://your-service-name.onrender.com/health`
   - **Schedule:** Every 10 minutes
   - **Request Method:** GET
3. **Save** and activate

This will ping your service every 10 minutes, keeping it awake so the internal cron can run.

---

## Verify Scheduler is Working

After deploying the updated code with better logging:

1. **Check startup logs** - Should see timezone and schedule info
2. **Wait for 10 AM** - Check logs for trigger message
3. **If no trigger** - Service is likely sleeping (use external cron to keep awake)

---

## Next Steps

1. ✅ Deploy the updated code with better logging
2. ✅ Check Render logs at startup
3. ✅ Set up external cron to keep service awake (if on free plan)
4. ✅ Monitor logs at 10 AM tomorrow
5. ✅ Verify summary posts to Slack

---

**Last Updated:** January 2024

