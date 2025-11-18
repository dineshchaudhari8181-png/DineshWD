/**
 * SCHEDULER.JS - Daily Summary Scheduler
 * 
 * This file handles scheduling the daily summary to run automatically.
 * It uses the "node-cron" library to run a job at a specific time every day.
 * 
 * How it works:
 * 1. When server starts, scheduleDailySummary() is called
 * 2. It sets up a cron job to run at the scheduled time (e.g., 12:30 PM IST)
 * 3. When the time comes, it calls runDailySummaryJob()
 * 4. runDailySummaryJob() collects yesterday's stats and posts to Slack
 * 
 * Cron schedule format: "minute hour day month weekday"
 * Example: "30 12 * * *" means: at 12:30 PM every day
 */

// Import node-cron library for scheduling
const cron = require('node-cron');
// Import config to get schedule and timezone settings
const config = require('./config');
// Import functions to collect stats and post to Slack
const { collectStatsForDate, persistSummary } = require('./statsService');
const { postSummary } = require('./slackClient');

/**
 * Parse a date string into a Date object
 * 
 * @param {string} input - Date string (e.g., "2024-01-15")
 * @returns {Date|null} - Date object or null if invalid
 */
function parseDateInput(input) {
  if (!input) return null;  // If no input, return null
  const parsed = new Date(input);  // Try to parse the date string
  // If parsing failed (invalid date), return null
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Get the default date for the summary
 * Usually this is yesterday (for scheduled runs)
 * But can be today (for manual testing)
 * 
 * @param {boolean} useToday - If true, return today. If false, return yesterday
 * @returns {Date} - Date object set to start of day (00:00:00)
 */
function getDefaultDate(useToday = false) {
  // Create a new Date object (current date/time)
  const d = new Date();
  
  // If useToday is false, subtract 1 day (get yesterday)
  if (!useToday) {
    d.setDate(d.getDate() - 1);  // Go back 1 day
  }
  
  // Set time to 00:00:00.000 (start of day)
  d.setHours(0, 0, 0, 0);
  
  return d;
}

/**
 * Run the daily summary job
 * This function:
 * 1. Determines which date to collect stats for (usually yesterday)
 * 2. Collects all statistics for that date
 * 3. Posts the summary to Slack
 * 4. Saves the summary to database
 * 
 * @param {object} options - Options for the job
 * @param {string} options.date - Optional date string (e.g., "2024-01-15")
 * @param {boolean} options.defaultToToday - If true, use today. If false, use yesterday
 */
async function runDailySummaryJob({ date, defaultToToday = false } = {}) {
  // Determine which date to use:
  // 1. If date parameter is provided, parse it
  // 2. Otherwise, use getDefaultDate() (yesterday by default, or today if defaultToToday is true)
  const targetDate = parseDateInput(date) || getDefaultDate(defaultToToday);

  try {
    // Step 1: Collect all statistics for the target date
    // This counts reactions, messages, files, members, etc. from that day
    const summary = await collectStatsForDate(targetDate);
    
    // Step 2: Post the summary to Slack
    // This sends a formatted message to the channel
    // messageTs is the timestamp of the Slack message (so we can reference it later)
    const messageTs = await postSummary(summary);
    
    // Step 3: Save the summary to database
    // This stores the results so we have a history of all summaries
    await persistSummary(summary, messageTs);
    
    // Log success message
    console.log(
      `✅ Posted summary for ${summary.statDate}: ${summary.reactionCount} reactions, ${summary.newMemberCount} new members.`
    );
  } catch (error) {
    // If something goes wrong, log the error but don't crash
    console.error('\n❌ ========================================');
    console.error('❌ Failed to post daily summary:');
    console.error('❌ Error:', error.message);
    console.error('❌ Stack:', error.stack);
    console.error('❌ ========================================\n');
  }
}

/**
 * Schedule the daily summary to run automatically
 * This sets up a cron job that runs at the configured time every day
 * 
 * The cron job will:
 * - Run at the time specified in CRON_SCHEDULE (e.g., "30 12 * * *" = 12:30 PM)
 * - Use the timezone specified in CRON_TIMEZONE (e.g., "Asia/Kolkata")
 * - Call runDailySummaryJob() which collects yesterday's stats
 */
function scheduleDailySummary() {
  // Check if channel ID is configured
  if (!config.slackChannelId) {
    console.warn('⚠️  SLACK_CHANNEL_ID not set. Scheduler will not run.');
    return;  // Exit early if not configured
  }

  // Log current time and timezone for debugging
  const now = new Date();
  console.log(`🕐 Current server time: ${now.toISOString()}`);
  console.log(`🌍 Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  console.log(`⏰ Scheduled timezone: ${config.timezone}`);
  console.log(`📅 Cron schedule: "${config.cronSchedule}"`);

  // Set up the cron job
  const task = cron.schedule(
    config.cronSchedule,  // When to run (e.g., "30 12 * * *" = 12:30 PM daily)
    () => {
      // This function runs when the scheduled time arrives
      const triggerTime = new Date();
      console.log(`\n⏰ ========================================`);
      console.log(`⏰ Running scheduled Slack summary job...`);
      console.log(`⏰ Triggered at: ${triggerTime.toISOString()}`);
      console.log(`⏰ Timezone: ${config.timezone}`);
      console.log(`⏰ ========================================\n`);
      // Run the summary job (will use yesterday's date by default)
      runDailySummaryJob();
    },
    {
      timezone: config.timezone,  // Which timezone (e.g., "Asia/Kolkata")
      scheduled: true,  // Start the task immediately
    }
  );

  // Log that the scheduler is set up
  console.log(
    `📆 Scheduler initialized. Summaries will post at "${config.cronSchedule}" (${config.timezone}).`
  );
  
  // Log next run time (approximate)
  console.log(`📆 Next scheduled run: Tomorrow at 12:30 PM ${config.timezone}`);
  
  // Verify cron is valid
  if (!cron.validate(config.cronSchedule)) {
    console.error(`❌ ERROR: Invalid cron schedule: "${config.cronSchedule}"`);
    console.error(`   Format should be: "minute hour day month weekday"`);
    console.error(`   Example: "30 12 * * *" for 12:30 PM daily`);
  }
}

// Export functions so server.js can use them
module.exports = {
  scheduleDailySummary,  // Function to set up the scheduler (called when server starts)
  runDailySummaryJob,    // Function to run the summary manually (for testing)
};
