# 📚 Complete Setup Guide - From Scratch to Production

This guide covers **everything** from initial setup to production deployment, including Git commits.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [PostgreSQL Database Setup](#2-postgresql-database-setup)
3. [Project Initialization](#3-project-initialization)
4. [Slack App Setup](#4-slack-app-setup)
5. [Local Development Setup](#5-local-development-setup)
6. [Testing Locally](#6-testing-locally)
7. [Git Setup & Commits](#7-git-setup--commits)
8. [Render Deployment](#8-render-deployment)
9. [Final Verification](#9-final-verification)

---

## 1. Prerequisites

### Required Software

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **PostgreSQL** (v12 or higher) - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/downloads)
- **ngrok** (for local testing) - [Download](https://ngrok.com/download)

### Required Accounts

- **Slack Workspace** (with admin permissions)
- **GitHub Account** (for code hosting)
- **Render Account** (for deployment) - [Sign up](https://render.com)

---

## 2. PostgreSQL Database Setup

### 2.1 Install PostgreSQL

1. Download and install PostgreSQL from https://www.postgresql.org/download/
2. During installation, remember the **postgres user password** you set

### 2.2 Create Database and User

Open **Command Prompt** or **PowerShell** and run:

```bash
# Connect to PostgreSQL as postgres user
psql -U postgres
```

Enter your postgres password when prompted.

Then run these SQL commands one by one:

```sql
-- Create database
CREATE DATABASE slack_dev_db;

-- Create user
CREATE USER slack_user WITH PASSWORD 'Ranjeesh83#';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE slack_dev_db TO slack_user;

-- Connect to the new database
\c slack_dev_db

-- Grant schema privileges (important!)
GRANT ALL ON SCHEMA public TO slack_user;

-- Exit psql
\q
```

**Note:** Replace `'Ranjeesh83#'` with your desired password.

### 2.3 Verify Database

```bash
# Test connection
psql -U slack_user -d slack_dev_db
```

If it connects successfully, you're done! Type `\q` to exit.

---

## 3. Project Initialization

### 3.1 Create Project Folder

```bash
# Create project directory
mkdir "C:\Slack Dev"
cd "C:\Slack Dev"
```

### 3.2 Initialize Node.js Project

```bash
# Initialize npm project
npm init -y
```

### 3.3 Install Dependencies

```bash
# Install all required packages
npm install express @slack/web-api body-parser node-cron pg dotenv

# Install development dependency
npm install --save-dev nodemon
```

### 3.4 Create Project Structure

Create these folders and files:

```
C:\Slack Dev\
├── src\
│   ├── server.js
│   ├── config.js
│   ├── db.js
│   ├── eventsHandler.js
│   ├── eventsStore.js
│   ├── statsService.js
│   ├── scheduler.js
│   └── slackClient.js
├── .env
├── .gitignore
├── package.json
└── README.md
```

### 3.5 Update package.json

Edit `package.json` and update:

```json
{
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  }
}
```

### 3.6 Create .gitignore

Create `.gitignore` file:

```
node_modules/
.env
*.log
.DS_Store
```

---

## 4. Slack App Setup

### 4.1 Create Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. Enter app name: `DailyEngage` (or your choice)
5. Select your workspace
6. Click **"Create App"**

### 4.2 Configure Bot Token Scopes

1. Go to **"OAuth & Permissions"** in left sidebar
2. Scroll to **"Bot Token Scopes"**
3. Add these scopes:
   - `chat:write` - Send messages
   - `channels:history` - View messages in public channels
   - `groups:history` - View messages in private channels
   - `mpim:history` - View group direct messages
   - `im:history` - View direct messages
   - `reactions:read` - View reactions
4. Click **"Save Changes"**

### 4.3 Install App to Workspace

1. Scroll to top of **"OAuth & Permissions"** page
2. Click **"Install to Workspace"**
3. Review permissions and click **"Allow"**
4. **Copy the Bot User OAuth Token** (starts with `xoxb-`)
   - Save this for `.env` file

### 4.4 Get Signing Secret

1. Go to **"Basic Information"** in left sidebar
2. Scroll to **"App Credentials"**
3. **Copy the Signing Secret**
   - Save this for `.env` file

### 4.5 Get Channel ID

1. Open Slack and go to your channel
2. Right-click the channel name → **"Copy Link"**
3. The link looks like: `https://workspace.slack.com/archives/C09SUH2KHK2`
4. The **Channel ID** is the last part: `C09SUH2KHK2`
   - Save this for `.env` file

### 4.6 Configure Event Subscriptions (Later)

We'll configure this after setting up the server URL. For now, note that you'll need to subscribe to:

- `reaction_added`
- `member_joined_channel`
- `member_left_channel`
- `message.channels` (important: use `.channels`, not just `message`)
- `file_shared`

---

## 5. Local Development Setup

### 5.1 Create .env File

Create `.env` file in project root:

```env
# Server Configuration
PORT=3000

# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_CHANNEL_ID=C09SUH2KHK2

# Scheduler Configuration
CRON_SCHEDULE=0 10 * * *
CRON_TIMEZONE=Asia/Kolkata

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=slack_dev_db
DB_USER=slack_user
DB_PASSWORD=Ranjeesh83#
```

**Replace:**
- `xoxb-your-bot-token-here` with your Bot User OAuth Token
- `your-signing-secret-here` with your Signing Secret
- `C09SUH2KHK2` with your Channel ID
- `Ranjeesh83#` with your database password

### 5.2 Add Source Code Files

Copy all source code files to `src/` folder:
- `src/server.js`
- `src/config.js`
- `src/db.js`
- `src/eventsHandler.js`
- `src/eventsStore.js`
- `src/statsService.js`
- `src/scheduler.js`
- `src/slackClient.js`

(All files are already in your project with detailed comments)

### 5.3 Start Server Locally

```bash
# Start the server
npm start
```

You should see:
```
📆 Scheduler initialized. Summaries will post at "0 10 * * *" (Asia/Kolkata).
🚀 Server listening on http://localhost:3000
```

### 5.4 Expose Server with ngrok

Open a **new terminal** and run:

```bash
# Start ngrok tunnel
ngrok http 3000
```

You'll get a URL like: `https://abc123.ngrok-free.app`

**Copy this URL** - you'll need it for Slack configuration.

### 5.5 Configure Slack Event Subscriptions

1. Go to https://api.slack.com/apps → Your App
2. Click **"Event Subscriptions"** in left sidebar
3. Toggle **"Enable Events"** to ON
4. Enter **Request URL**: `https://your-ngrok-url.ngrok-free.app/api/slack/events`
5. Slack will verify the URL (should show green checkmark ✅)
6. Scroll to **"Subscribe to bot events"**
7. Click **"Add Bot User Event"** and add:
   - `reaction_added`
   - `member_joined_channel`
   - `member_left_channel`
   - `message.channels` ← **Important: Use `.channels`**
   - `file_shared`
8. Click **"Save Changes"**
9. **Reinstall the app** to workspace:
   - Go to **"OAuth & Permissions"**
   - Click **"Reinstall to Workspace"**
   - Click **"Allow"**

### 5.6 Invite Bot to Channel

1. Open your Slack channel
2. Type: `/invite @DailyEngage`
3. Or click channel name → **"Integrations"** → **"Add apps"** → Search for your bot

---

## 6. Testing Locally

### 6.1 Test Health Endpoint

Open browser or use curl:

```bash
curl http://localhost:3000/health
```

Should return:
```json
{"status":"ok","message":"Slack stats service running."}
```

### 6.2 Test Event Reception

1. Send a message in your Slack channel
2. Add a reaction to a message
3. Upload a file
4. Check server logs - you should see:
   ```
   📥 Received event: message
   ✅ Message event saved
   ```

### 6.3 Test Manual Summary

```bash
# Using PowerShell
Invoke-WebRequest -Uri "http://localhost:3000/api/slack/run-summary" -Method POST -ContentType "application/json" -Body '{"date":"2024-01-15"}'
```

Or use Postman/curl:
```bash
curl -X POST http://localhost:3000/api/slack/run-summary \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2024-01-15\"}"
```

### 6.4 Verify Database

```bash
# Connect to database
psql -U slack_user -d slack_dev_db

# Check tables
\dt

# Check message count
SELECT COUNT(*) FROM message_events;

# Check reaction count
SELECT COUNT(*) FROM reaction_events;

# Exit
\q
```

---

## 7. Git Setup & Commits

### 7.1 Initialize Git Repository

```bash
# Navigate to project folder
cd "C:\Slack Dev"

# Initialize git
git init

# Set default branch to main
git branch -M main
```

### 7.2 Create GitHub Repository

1. Go to https://github.com
2. Click **"New repository"**
3. Repository name: `slack-daily-stats` (or your choice)
4. Description: "Slack daily channel statistics service"
5. Choose **Public** or **Private**
6. **DO NOT** initialize with README, .gitignore, or license
7. Click **"Create repository"**

### 7.3 Connect Local Repository to GitHub

```bash
# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Verify remote
git remote -v
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name.

### 7.4 First Commit

```bash
# Stage all files
git add .

# Check what will be committed
git status

# Create first commit
git commit -m "Initial commit: Slack daily stats service with PostgreSQL"

# Push to GitHub
git push -u origin main
```

### 7.5 Subsequent Commits (When Making Changes)

Whenever you make code changes:

```bash
# 1. Check what changed
git status

# 2. Stage changes
git add .

# 3. Commit with descriptive message
git commit -m "Description of what you changed"

# 4. Push to GitHub
git push origin main
```

**Example commit messages:**
```bash
git commit -m "Add detailed code comments to all files"
git commit -m "Update scheduler to run at 10 AM daily"
git commit -m "Fix message event handling for bot messages"
git commit -m "Add file upload tracking support"
```

### 7.6 Verify Code is on GitHub

1. Go to your GitHub repository
2. You should see all your files
3. Check that `.env` is **NOT** visible (it's in .gitignore)

---

## 8. Render Deployment

### 8.1 Create PostgreSQL Database on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `slack-stats-db`
   - **Database**: `slack_dev_db`
   - **User**: `slack_user`
   - **Region**: Choose closest to you
   - **Plan**: Free (or paid)
4. Click **"Create Database"**
5. **Wait for database to be created** (takes 1-2 minutes)
6. Go to database dashboard
7. **Copy the connection details:**
   - Internal Database URL (looks like: `postgresql://user:pass@host:5432/dbname`)
   - Or note: Host, Port, Database, User, Password separately

### 8.2 Create Web Service on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account (if not already connected)
4. Select your repository
5. Configure service:

**Basic Settings:**
- **Name**: `slack-stats-service`
- **Environment**: `Node`
- **Region**: Same as database
- **Branch**: `main`
- **Root Directory**: (leave empty)
- **Build Command**: `npm install`
- **Start Command**: `npm start`

**Environment Variables:**

Click **"Add Environment Variable"** and add each:

```
NODE_ENV=production
PORT=10000
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_CHANNEL_ID=C09SUH2KHK2
CRON_SCHEDULE=0 10 * * *
CRON_TIMEZONE=Asia/Kolkata
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

**OR use individual DB variables:**
```
DB_HOST=dpg-xxx.oregon-postgres.render.com
DB_PORT=5432
DB_NAME=slack_dev_db
DB_USER=slack_user
DB_PASSWORD=your-password-here
DB_SSL=true
```

**Advanced Settings:**
- **Auto-Deploy**: Yes
- **Health Check Path**: `/health`

6. Click **"Create Web Service"**
7. **Wait for deployment** (takes 3-5 minutes)

### 8.3 Get Render Service URL

Once deployed, you'll see:
```
Available at: https://slack-stats-service.onrender.com
```

**Copy this URL** - you'll need it for Slack.

### 8.4 Update Slack Request URL

1. Go to https://api.slack.com/apps → Your App
2. Click **"Event Subscriptions"**
3. Update **Request URL** to:
   ```
   https://slack-stats-service.onrender.com/api/slack/events
   ```
4. Slack will verify automatically (should show ✅)
5. Click **"Save Changes"**

### 8.5 Verify Deployment

1. **Check Health:**
   ```bash
   curl https://slack-stats-service.onrender.com/health
   ```
   Should return: `{"status":"ok","message":"Slack stats service running."}`

2. **Check Logs:**
   - Go to Render Dashboard → Your Service → **"Logs"** tab
   - You should see:
     ```
     🚀 Server listening on http://localhost:10000
     📆 Scheduler initialized. Summaries will post at "0 10 * * *" (Asia/Kolkata).
     ```

3. **Test Manual Summary:**
   ```bash
   curl -X POST https://slack-stats-service.onrender.com/api/slack/run-summary \
     -H "Content-Type: application/json" \
     -d '{"date":"2024-01-15"}'
   ```

---

## 9. Final Verification

### 9.1 Test Event Flow

1. **Send a message** in your Slack channel
2. **Add a reaction** to a message
3. **Upload a file**
4. **Check Render logs** - should see events being received

### 9.2 Verify Database

1. Go to Render Dashboard → PostgreSQL service
2. Click **"Connect"** → **"psql"**
3. Run:
   ```sql
   -- List all tables
   \dt
   
   -- Check message count
   SELECT COUNT(*) FROM message_events;
   
   -- Check reaction count
   SELECT COUNT(*) FROM reaction_events;
   
   -- Check file count
   SELECT COUNT(*) FROM file_events;
   ```

### 9.3 Test Daily Summary

1. Wait for scheduled time (10 AM) OR
2. Trigger manually:
   ```bash
   curl -X POST https://slack-stats-service.onrender.com/api/slack/run-summary \
     -H "Content-Type: application/json"
   ```
3. Check your Slack channel - should see daily summary message

### 9.4 Verify Scheduler

1. Check Render logs at scheduled time (10 AM)
2. Should see:
   ```
   ⏰ Running scheduled Slack summary job...
   ✅ Posted summary for 2024-01-15: 25 reactions, 3 new members.
   ```

---

## 🎉 You're Done!

Your Slack Daily Stats Service is now:
- ✅ Running locally for development
- ✅ Deployed to Render for production
- ✅ Tracking all events (messages, reactions, files, members)
- ✅ Posting daily summaries automatically
- ✅ Code is version controlled on GitHub

---

## 📝 Quick Reference

### Common Git Commands

```bash
# Check status
git status

# Stage all changes
git add .

# Commit changes
git commit -m "Your message"

# Push to GitHub
git push origin main

# Pull latest changes
git pull origin main
```

### Common Commands

```bash
# Start server locally
npm start

# Start with auto-reload (development)
npm run dev

# Check database connection
psql -U slack_user -d slack_dev_db

# Test health endpoint
curl http://localhost:3000/health
```

### Important URLs

- **Slack App Dashboard**: https://api.slack.com/apps
- **Render Dashboard**: https://dashboard.render.com
- **GitHub Repository**: https://github.com/YOUR_USERNAME/YOUR_REPO

---

## 🆘 Troubleshooting

### Events Not Being Received

1. Check Slack Request URL is correct
2. Verify service is running (not sleeping)
3. Check Render logs for errors
4. Verify bot is invited to channel

### Database Connection Issues

1. Verify `DATABASE_URL` or DB credentials are correct
2. Check database is running in Render
3. Verify SSL is enabled (`DB_SSL=true`)

### Service Won't Start

1. Check all environment variables are set
2. Verify `PORT=10000` (Render requirement)
3. Check Render logs for specific errors

---

## 📚 Additional Resources

- **Slack API Docs**: https://api.slack.com/docs
- **Render Docs**: https://render.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Node.js Docs**: https://nodejs.org/docs/

---

**Last Updated**: January 2024
**Version**: 1.0

