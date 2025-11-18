# 🔍 Debug Checklist for 12:30 PM IST

## What to Check at 12:30 PM

### Step 1: Check Render Service Status (Before 12:30 PM)

**Time: 12:25 PM (5 minutes before)**

1. Go to **Render Dashboard** → Your Service
2. Check **Status**:
   - ✅ **"Live"** (green) = Service is running, scheduler should work
   - ⚠️ **"Sleeping"** (gray) = Service is asleep, scheduler WON'T run
   
**If sleeping:**
- The service needs to be woken up before 12:30 PM
- Use external cron service to ping `/health` every 10 minutes
- Or manually visit: `https://your-service.onrender.com/health`

---

### Step 2: Check Render Logs (At 12:30 PM)

**Time: 12:30 PM - 12:35 PM**

1. Go to **Render Dashboard** → Your Service → **"Logs"** tab
2. **Scroll to the bottom** (most recent logs)
3. Look for these messages:

#### ✅ SUCCESS - Scheduler Triggered:

```
⏰ ========================================
⏰ Running scheduled Slack summary job...
⏰ Triggered at: 2024-01-15T07:00:00.000Z
⏰ Timezone: Asia/Kolkata
⏰ ========================================
```

**Then you should see:**
```
✅ Posted summary for 2024-01-14: 25 reactions, 3 new members.
```

#### ❌ ERROR - Something Went Wrong:

```
❌ ========================================
❌ Failed to post daily summary:
❌ Error: [error message]
❌ Stack: [stack trace]
❌ ========================================
```

#### ⚠️ NO LOGS - Scheduler Didn't Run:

- **No logs at all** = Service was sleeping
- **No "⏰ Running scheduled" message** = Cron didn't trigger

---

### Step 3: Check Slack Channel

**Time: 12:30 PM - 12:35 PM**

1. Open your Slack channel
2. Look for a message from your bot with:
   - Header: `📊 Daily Channel Summary - YYYY-MM-DD`
   - Table with statistics
   - Date should be **yesterday's date**

**If message appears:**
- ✅ Everything worked!

**If no message:**
- Check Render logs for errors
- Verify bot has `chat:write` permission
- Check channel ID is correct

---

### Step 4: Verify Database (Optional)

**Time: After 12:35 PM**

1. Go to **Render Dashboard** → PostgreSQL service
2. Click **"Connect"** → **"psql"**
3. Run:

```sql
-- Check if summary was saved
SELECT * FROM daily_summaries 
ORDER BY created_at DESC 
LIMIT 1;

-- Should show:
-- - stat_date: yesterday's date
-- - All counts (reaction_count, message_count, etc.)
-- - created_at: around 12:30 PM today
```

**If record exists:**
- ✅ Summary was generated and saved
- Check why it didn't post to Slack (permissions issue)

**If no record:**
- Summary job didn't run or failed
- Check Render logs for errors

---

## Quick Debug Commands

### Check Service Health:
```bash
curl https://your-service.onrender.com/health
```
Should return: `{"status":"ok","message":"Slack stats service running."}`

### Check Recent Logs:
- Render Dashboard → Your Service → Logs
- Filter by time: 12:25 PM - 12:35 PM

### Test Manual Summary (If 12:30 didn't work):
```bash
curl -X POST https://your-service.onrender.com/api/slack/run-summary \
  -H "Content-Type: application/json"
```

---

## Common Issues & Solutions

### Issue 1: No Logs at 12:30 PM

**Possible Causes:**
- Service was sleeping
- Cron didn't trigger
- Service crashed

**Solution:**
1. Check service status (should be "Live")
2. Check if service was restarted recently
3. Use external cron to keep service awake

### Issue 2: Logs Show Error

**Check the error message:**
- Database connection error → Check DB credentials
- Slack API error → Check bot token
- Missing data → Check if events were stored

**Solution:**
- Fix the specific error shown in logs
- Test manually after fixing

### Issue 3: Summary Generated But Not Posted

**Symptoms:**
- Logs show: `✅ Posted summary for...`
- But no message in Slack

**Possible Causes:**
- Bot not invited to channel
- Missing `chat:write` permission
- Wrong channel ID

**Solution:**
1. Verify bot is in channel: `/invite @YourBotName`
2. Check permissions in Slack app settings
3. Verify `SLACK_CHANNEL_ID` is correct

---

## What to Look For in Logs

### Good Logs (Everything Working):

```
🕐 Current server time: 2024-01-15T07:00:00.000Z
🌍 Server timezone: UTC
⏰ Scheduled timezone: Asia/Kolkata
📅 Cron schedule: "30 12 * * *"
📆 Scheduler initialized. Summaries will post at "30 12 * * *" (Asia/Kolkata).
📆 Next scheduled run: Tomorrow at 12:30 PM Asia/Kolkata

[At 12:30 PM IST]

⏰ ========================================
⏰ Running scheduled Slack summary job...
⏰ Triggered at: 2024-01-15T07:00:00.000Z
⏰ Timezone: Asia/Kolkata
⏰ ========================================

✅ Posted summary for 2024-01-14: 25 reactions, 3 new members, 150 messages, 5 files.
```

### Bad Logs (Something Wrong):

```
[No logs at 12:30 PM]
OR
❌ ========================================
❌ Failed to post daily summary:
❌ Error: Cannot read property 'channel' of undefined
❌ Stack: ...
❌ ========================================
```

---

## Pre-12:30 PM Checklist

**Before 12:30 PM, verify:**

- [ ] Service status is "Live" (not "Sleeping")
- [ ] Environment variables are set:
  - [ ] `CRON_SCHEDULE=30 12 * * *`
  - [ ] `CRON_TIMEZONE=Asia/Kolkata`
  - [ ] `SLACK_BOT_TOKEN` is set
  - [ ] `SLACK_CHANNEL_ID` is set
- [ ] Bot is invited to the channel
- [ ] Service was started/redeployed recently (to ensure scheduler is active)

---

## Post-12:30 PM Checklist

**After 12:30 PM, verify:**

- [ ] Logs show "⏰ Running scheduled Slack summary job..."
- [ ] Logs show "✅ Posted summary for..."
- [ ] Message appears in Slack channel
- [ ] Message shows yesterday's date
- [ ] Database has new record in `daily_summaries` table

---

## If Nothing Happens

1. **Check service status** - Is it "Live"?
2. **Check logs** - Any errors at startup?
3. **Test manually** - Run `/api/slack/run-summary` endpoint
4. **Check timezone** - Verify `CRON_TIMEZONE=Asia/Kolkata`
5. **Check schedule** - Verify `CRON_SCHEDULE=30 12 * * *`
6. **Restart service** - Sometimes helps if scheduler didn't initialize

---

**Remember:** Render free plan services sleep after 15 minutes. If your service was sleeping at 12:30 PM, the cron won't run. Use an external cron service to keep it awake!

