# 🧭 Project Architecture & File Responsibilities

This document explains how the Slack Daily Stats Service is structured, what each module does, and how requests/data flow through the system.

---

## 1. High-Level Flow

### Slack Event Pipeline
1. **Slack** posts events (messages, reactions, etc.) to `POST /api/slack/events`.
2. **`src/server.js`** verifies the signature and passes the payload to `processSlackEvent`.
3. **`src/eventsHandler.js`** inspects the event type and saves it through `eventsStore`.
4. **`src/eventsStore.js`** writes the event into the corresponding PostgreSQL table (`message_events`, `reaction_events`, etc.).

### Daily Summary Pipeline
1. **`src/scheduler.js`** schedules `runDailySummaryJob` (cron) and exposes a manual trigger via `/api/slack/run-summary`.
2. `runDailySummaryJob` calls **`statsService.collectStatsForDate`** to aggregate yesterday's counts.
3. Counts are formatted by **`src/slackClient.js`** and pushed to Slack.
4. Results are persisted in **`daily_summaries`** via **`eventsStore.saveDailySummary`**.

---

## 2. File-by-File Responsibilities

| File | Responsibility | Key Functions |
| --- | --- | --- |
| `src/server.js` | Entry point. Sets up Express, middleware, Slack endpoints, manual summary endpoint, starts scheduler. | `verifySlackSignature`, `/api/slack/events`, `/api/slack/run-summary`, `start()` |
| `src/config.js` | Loads environment variables (.env). Provides a typed config object used everywhere. | `config` object |
| `src/db.js` | Creates PostgreSQL pool and initializes schema (one table per event type + `daily_summaries`). | `getPoolConfig`, `initDb`, `pool` |
| `src/eventsHandler.js` | Contains per-event logic; converts Slack payloads to DB records. | `handleReactionAdded`, `handleMemberJoined`, `handleMessage`, `handleFileShared`, `processSlackEvent` |
| `src/eventsStore.js` | All DB interaction helpers (insert events, aggregate counts, save summaries). | `saveReactionEvent`, `countMessagesBetween`, `saveDailySummary`, etc. |
| `src/statsService.js` | Calculates statistics for a day (yesterday by default) using eventsStore. Persists summary metadata. | `collectStatsForDate`, `persistSummary`, `getDayRange` |
| `src/slackClient.js` | Builds Block Kit table and posts to Slack using `@slack/web-api`. | `buildSummaryBlocks`, `postSummary` |
| `src/scheduler.js` | Parses cron schedule, ensures we always target yesterday’s date, schedules daily job, logs next run time. | `getDefaultDate`, `runDailySummaryJob`, `scheduleDailySummary`, `parseDailyCronTime` |
| `src/eventsHandler.js` | (Already above) connects incoming Slack events to DB storage. | |
| `ARCHITECTURE_OVERVIEW.md` | *This* file – documentation of architecture. | |
| Additional docs | `README.md`, `RENDER_DEPLOYMENT_GUIDE.md`, `SLACK_PERMISSIONS_REQUIRED.md`, `COMPLETE_SETUP_GUIDE.md`, etc. | Setup & deployment instructions |

---

## 3. Detailed Call Chains

### A. Slack Event → Database

```
Slack → server.js (/api/slack/events)
    → eventsHandler.processSlackEvent(payload)
        ├─ handleMessage → eventsStore.saveMessageEvent()
        ├─ handleReactionAdded → eventsStore.saveReactionEvent()
        ├─ handleMemberJoined/member_left → eventsStore.saveMemberEvent()
        └─ handleFileShared → eventsStore.saveFileEvent()
```

### B. Scheduler → Daily Summary

```
scheduler.scheduleDailySummary()
    └─ cron fires runDailySummaryJob()
        ├─ statsService.collectStatsForDate(targetDate)
        │     └─ eventsStore.count*Between() (per event table)
        ├─ slackClient.postSummary(summary)
        └─ statsService.persistSummary(summary, messageTs)
```

### C. Manual Trigger (testing same pipeline)

```
POST /api/slack/run-summary (server.js)
    └─ runDailySummaryJob({ date, defaultToToday:false })
        ↳ same as above
```

---

## 4. Database Schema Snapshot

- `reaction_events`: one row per `reaction_added`
- `member_events`: `member_joined_channel` & `member_left_channel`
- `message_events`: user messages (excluding bots/subtypes)
- `file_events`: `file_shared` events
- `daily_summaries`: aggregated counts (+ Slack message timestamp)

Tables are created automatically by `initDb()` the first time the server runs.

---

## 5. Key Design Choices

1. **One table per event type** – keeps inserts/queries simple and makes debugging easy.
2. **Timezone-aware date math** – `getDefaultDate()` uses `config.timezone` and always moves one day back for scheduled runs, ensuring "yesterday" is correct regardless of server timezone.
3. **Manual endpoint** mirrors scheduler – so testing uses the exact same logic.
4. **Idempotent summary saves** – `saveDailySummary` uses `ON CONFLICT` to update existing rows so re-running the summary for the same date refreshes the counts & Slack message.
5. **Verbose logging** – each stage logs what it’s doing, which helps when checking Render logs around the cron time.

---

## 6. Where to Look When Debugging

- **Event reception problems:** `src/server.js` & `src/eventsHandler.js` logs.
- **No rows in DB:** check `eventsStore.save*` functions and PostgreSQL tables.
- **Wrong counts:** look at `statsService.collectStatsForDate` and the `count*Between` queries.
- **Scheduler issues:** `src/scheduler.js` logs current time, cron schedule, next run, and cron trigger.
- **Slack message formatting:** `src/slackClient.js`.

---

Use this document as a map when navigating the codebase or onboarding new contributors. Let me know if you want diagrams or deeper walkthroughs of any specific module. 🙌

