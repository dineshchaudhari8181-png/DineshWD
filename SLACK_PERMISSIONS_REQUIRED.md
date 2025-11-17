# Required Slack App Permissions

To track all metrics (messages, files, reactions, members), you need to subscribe to these events in your Slack app:

## Bot Token Scopes (OAuth & Permissions)

Already configured:
- ✅ `chat:write` - Send messages
- ✅ `channels:history` - View messages in public channels
- ✅ `groups:history` - View messages in private channels
- ✅ `mpim:history` - View group direct messages
- ✅ `im:history` - View direct messages
- ✅ `reactions:read` - View reactions

## Event Subscriptions (Subscribe to bot events)

**Currently subscribed:**
- ✅ `reaction_added` - Working (8 reactions stored)
- ✅ `member_joined_channel` - Working (2 members stored)

**MISSING - Need to add these:**
- ❌ `message.channels` - Required to count messages in public channels (NOT just `message`)
- ❌ `message.groups` - Required to count messages in private channels (optional)
- ❌ `file_shared` - Required to count file uploads
- ❌ `member_left_channel` - Required to count members removed

**IMPORTANT:** Use `message.channels` (not `message`) for public channel messages!

## How to Add Missing Events

1. Go to https://api.slack.com/apps
2. Select your app (DailyEngage)
3. Click **"Event Subscriptions"** in the left sidebar
4. Scroll down to **"Subscribe to bot events"**
5. Click **"Add Bot User Event"** and add:
   - `message.channels` ← **Use this for public channel messages (NOT just `message`)**
   - `message.groups` ← Optional: for private channel messages
   - `file_shared` ← For file uploads
   - `member_left_channel` ← For members leaving
6. Click **"Save Changes"**
7. **Reinstall the app** to your workspace (OAuth & Permissions → Reinstall to Workspace)

**Note:** Even though you subscribe to `message.channels`, the event type in the payload is still `message`. The code handles this correctly.

## Database Table Structure

All tables are created correctly:

### `message_events`
- `event_id` (unique)
- `channel_id`
- `user_id`
- `message_ts`
- `raw_event` (JSON)

### `file_events`
- `event_id` (unique)
- `channel_id`
- `user_id`
- `file_id`
- `file_name`
- `event_ts`
- `raw_event` (JSON)

### `member_events`
- `event_id` (unique)
- `channel_id`
- `user_id`
- `event_type` (member_joined_channel or member_left_channel)
- `event_ts`
- `raw_event` (JSON)

### `reaction_events`
- `event_id` (unique)
- `channel_id`
- `user_id`
- `reaction`
- `event_ts`
- `raw_event` (JSON)

### `daily_summaries`
- `channel_id`
- `stat_date`
- `reaction_count`
- `new_member_count`
- `member_removed_count`
- `message_count`
- `file_upload_count`
- `message_ts`

## After Adding Events

Once you add the missing events and reinstall:
1. Restart your server
2. Send a test message in the channel
3. Upload a test file
4. Remove a member (if possible)
5. Run manual summary: `POST /api/slack/run-summary` with today's date
6. Check database: All counts should be > 0

