# Debug Guide: Why Messages Not Storing in Database

## Step-by-Step Debugging Process

### Step 1: Check if Slack is Sending Events

**Check Server Logs:**
Look at the terminal where `npm start` is running. When you send a message, you should see:
- `📥 Received event: message` - This means Slack sent the event
- If you DON'T see this → Slack isn't sending events (subscription issue)

**Check Slack Event Logs:**
1. Go to https://api.slack.com/apps → Your App
2. Click "Event Subscriptions" → Scroll down to "Event Logs"
3. Look for recent `message` events
4. Check if they show "200 OK" or errors

### Step 2: Check if Event Handler is Processing

**In Server Logs, look for:**
- `💬 Processing message event from channel: C09SUH2KHK2`
- `🔍 Message event details: {...}`

**If you see these but no save:**
- Check for `❌ Message skipped: Channel mismatch` - Wrong channel ID
- Check for `⏭️ Message skipped: Bot message or subtype` - Message filtered out
- Check for `❌ Error saving message event:` - Database error

### Step 3: Verify Channel ID Match

**Check your .env file:**
```
SLACK_CHANNEL_ID=C09SUH2KHK2
```

**In server logs, check:**
```
🔍 Message event details: {
  channelId: 'C09SUH2KHK2',  ← Should match your .env
  targetChannel: 'C09SUH2KHK2',
  ...
}
```

### Step 4: Check Database Connection

**Run this command:**
```powershell
$env:PGPASSWORD="Ranjeesh83#"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U slack_user -d slack_dev_db -c "SELECT COUNT(*) FROM message_events;"
```

**If this fails:**
- Database connection issue
- Check PostgreSQL is running
- Verify credentials in .env

### Step 5: Check Table Structure

**Verify table exists:**
```powershell
$env:PGPASSWORD="Ranjeesh83#"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U slack_user -d slack_dev_db -c "\d message_events;"
```

### Step 6: Test Manual Insert

**Try inserting a test record:**
```sql
INSERT INTO message_events (event_id, channel_id, user_id, message_ts, raw_event)
VALUES ('test_123', 'C09SUH2KHK2', 'U123', NOW(), '{}'::jsonb);
```

If this works, the table is fine. If it fails, there's a database issue.

## Common Issues & Solutions

### Issue 1: No Events Received
**Symptom:** No `📥 Received event: message` in logs
**Solution:** 
- Add `message.channels` to Slack Event Subscriptions
- Reinstall app to workspace
- Verify Request URL is correct

### Issue 2: Channel Mismatch
**Symptom:** `❌ Message skipped: Channel mismatch`
**Solution:**
- Verify SLACK_CHANNEL_ID in .env matches the channel
- Or remove SLACK_CHANNEL_ID to track all channels

### Issue 3: Bot Messages Filtered
**Symptom:** `⏭️ Message skipped: Bot message or subtype`
**Solution:**
- This is normal - bot messages are intentionally skipped
- Send a message as a regular user, not a bot

### Issue 4: Database Error
**Symptom:** `❌ Error saving message event: ...`
**Solution:**
- Check PostgreSQL is running
- Verify database credentials
- Check table exists (run \d message_events)

### Issue 5: Event Type Mismatch
**Symptom:** Events received but wrong type
**Solution:**
- Make sure you subscribed to `message.channels` (not just `message`)
- The event.type in payload is still `message`, but subscription must be `message.channels`

## Quick Debug Checklist

- [ ] Server is running (`npm start`)
- [ ] ngrok is running (if testing locally)
- [ ] Slack Request URL is verified
- [ ] `message.channels` is subscribed in Slack app
- [ ] App is reinstalled to workspace
- [ ] Bot is in the channel
- [ ] Sending message as regular user (not bot)
- [ ] Channel ID in .env matches the channel
- [ ] PostgreSQL is running
- [ ] Database credentials are correct
- [ ] Check server logs for errors

