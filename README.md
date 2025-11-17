# Slack Daily Stats Service

Automated daily summary service for Slack channels that tracks and reports:
- 💬 Messages sent
- 👍 Reactions added
- 📎 File uploads
- 👥 New members
- 👋 Members removed

## Features

- Real-time event tracking from Slack
- PostgreSQL database storage
- Automated daily summaries at scheduled time
- Beautiful Block Kit formatted messages
- Manual summary trigger endpoint
- Comprehensive logging and debugging

## Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create `.env` file:
   ```
   PORT=3000
   SLACK_BOT_TOKEN=xoxb-your-token
   SLACK_SIGNING_SECRET=your-secret
   SLACK_CHANNEL_ID=C1234567890
   CRON_SCHEDULE=0 17 * * *
   CRON_TIMEZONE=Asia/Kolkata
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=slack_dev_db
   DB_USER=slack_user
   DB_PASSWORD=your-password
   ```

3. **Start PostgreSQL** (if not running)

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Expose with ngrok** (for local testing):
   ```bash
   ngrok http 3000
   ```

6. **Update Slack Request URL** to your ngrok URL

### Production Deployment

See [RENDER_DEPLOYMENT_GUIDE.md](./RENDER_DEPLOYMENT_GUIDE.md) for complete Render deployment instructions.

## API Endpoints

### Health Check
```
GET /health
```

### Manual Summary Trigger
```
POST /api/slack/run-summary
Content-Type: application/json

{
  "date": "2025-11-17"  // Optional: YYYY-MM-DD format
}
```

### Slack Events (for Slack)
```
POST /api/slack/events
```

## Configuration

### Slack App Setup

1. Create app at https://api.slack.com/apps
2. Add Bot Token Scopes:
   - `chat:write`
   - `channels:history`
   - `groups:history`
   - `reactions:read`
3. Subscribe to Bot Events:
   - `reaction_added`
   - `member_joined_channel`
   - `member_left_channel`
   - `message.channels`
   - `file_shared`
4. Install app to workspace
5. Invite bot to channel

See [SLACK_PERMISSIONS_REQUIRED.md](./SLACK_PERMISSIONS_REQUIRED.md) for details.

## Database Schema

Tables are created automatically on first start:
- `reaction_events` - Stores reaction events
- `member_events` - Stores member join/leave events
- `message_events` - Stores message events
- `file_events` - Stores file upload events
- `daily_summaries` - Stores daily summary records

## Scheduler

Default schedule: 5:00 PM (Asia/Kolkata) daily

Configure via environment variables:
- `CRON_SCHEDULE` - Cron expression (default: `0 17 * * *`)
- `CRON_TIMEZONE` - Timezone (default: `Asia/Kolkata`)

## Debugging

### Check Database Stats
```bash
.\check-all-stats.bat
```

### Debug Messages
```bash
.\debug-messages.bat
```

### Check Logs
Server logs show:
- `📥 Received event: message` - Event received
- `✅ Message event saved` - Stored successfully
- `❌` - Errors

See [DEBUG_GUIDE.md](./DEBUG_GUIDE.md) for complete debugging guide.

## Project Structure

```
├── src/
│   ├── server.js          # Express server & routes
│   ├── config.js          # Configuration loader
│   ├── db.js              # Database connection & schema
│   ├── eventsHandler.js   # Slack event processing
│   ├── eventsStore.js     # Database operations
│   ├── statsService.js    # Statistics collection
│   ├── slackClient.js     # Slack API client
│   └── scheduler.js       # Cron job scheduler
├── .env                   # Environment variables (not in git)
├── package.json
└── README.md
```

## License

MIT
