const cron = require('node-cron');
const config = require('./config');
const { collectStatsForDate, persistSummary } = require('./statsService');
const { postSummary } = require('./slackClient');

function parseDateInput(input) {
  if (!input) return null;
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDefaultDate(useToday = false) {
  const d = new Date();
  if (!useToday) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

async function runDailySummaryJob({ date, defaultToToday = false } = {}) {
  const targetDate = parseDateInput(date) || getDefaultDate(defaultToToday);

  try {
    const summary = await collectStatsForDate(targetDate);
    const messageTs = await postSummary(summary);
    await persistSummary(summary, messageTs);
    console.log(
      `✅ Posted summary for ${summary.statDate}: ${summary.reactionCount} reactions, ${summary.newMemberCount} new members.`
    );
  } catch (error) {
    console.error('Failed to post daily summary:', error);
  }
}

function scheduleDailySummary() {
  if (!config.slackChannelId) {
    console.warn('⚠️  SLACK_CHANNEL_ID not set. Scheduler will not run.');
    return;
  }

  cron.schedule(
    config.cronSchedule,
    () => {
      console.log('⏰ Running scheduled Slack summary job...');
      runDailySummaryJob();
    },
    {
      timezone: config.timezone,
    }
  );

  console.log(
    `📆 Scheduler initialized. Summaries will post at "${config.cronSchedule}" (${config.timezone}).`
  );
}

module.exports = {
  scheduleDailySummary,
  runDailySummaryJob,
};

