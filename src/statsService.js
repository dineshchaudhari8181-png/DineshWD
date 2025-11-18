/**
 * STATS_SERVICE.JS - Statistics Collection Service
 * 
 * This file collects statistics for a specific date and saves the summary.
 * It's called by the scheduler when it's time to generate the daily summary.
 * 
 * Flow:
 * 1. Scheduler calls collectStatsForDate(yesterday's date)
 * 2. This function counts all events from that day
 * 3. Returns a summary object with all the counts
 * 4. The summary is then posted to Slack and saved to database
 */

// Import count functions from eventsStore.js
const {
  countReactionsBetween,
  countNewMembersBetween,
  countMembersRemovedBetween,
  countMessagesBetween,
  countFileUploadsBetween,
  saveDailySummary,
} = require('./eventsStore');
// Import config to get channel ID
const config = require('./config');

/**
 * Helper to extract the date components (year, month, day) for a given timezone.
 *
 * @param {Date} date - The reference date.
 * @param {string} timezone - IANA timezone string (e.g., "Asia/Kolkata").
 * @returns {{ year: number, month: number, day: number }}
 */
function getTimezoneDateParts(date, timezone = 'UTC') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const [year, month, day] = formatter.format(date).split('-').map(Number);
  return { year, month, day };
}

/**
 * Get the start and end times for a specific date in a specific timezone.
 * 
 * @param {Date} targetDate - The date we want to get the range for
 * @param {string} timezone - IANA timezone identifier (e.g., "Asia/Kolkata")
 * @returns {object} - Object with start and end Date objects (stored in UTC)
 * 
 * Example: getDayRange(new Date('2024-01-15'), 'Asia/Kolkata')
 *          Returns: { start: 2024-01-14T18:30:00.000Z, end: 2024-01-15T18:29:59.999Z }
 */
function getDayRange(targetDate, timezone = 'UTC') {
  const { year, month, day } = getTimezoneDateParts(targetDate, timezone);

  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  return { start, end };
}

/**
 * Collect all statistics for a specific date
 * This is the main function that gathers all the counts for the daily summary
 * 
 * @param {Date} targetDate - The date to collect stats for (usually yesterday)
 * @returns {object} - Summary object with all counts
 * 
 * Example return:
 * {
 *   channelId: "C09SUH2KHK2",
 *   statDate: "2024-01-15",
 *   reactionCount: 25,
 *   newMemberCount: 3,
 *   memberRemovedCount: 1,
 *   messageCount: 150,
 *   fileUploadCount: 5
 * }
 */
async function collectStatsForDate(targetDate) {
  // Check if channel ID is configured
  if (!config.slackChannelId) {
    throw new Error('SLACK_CHANNEL_ID is not configured.');
  }

  // Convert date to YYYY-MM-DD format in the configured timezone (e.g., "2024-01-15")
  const timezone = config.timezone || 'UTC';
  const statDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(targetDate);
  
  // Get the start and end times for this date
  const { start, end } = getDayRange(targetDate, timezone);

  // Count all events in parallel using Promise.all
  // Promise.all runs all these database queries at the same time (faster than one by one)
  // The results are stored in an array in the same order
  const [reactionCount, newMemberCount, memberRemovedCount, messageCount, fileUploadCount] = await Promise.all([
    countReactionsBetween(config.slackChannelId, start, end),        // Count reactions
    countNewMembersBetween(config.slackChannelId, start, end),       // Count new members
    countMembersRemovedBetween(config.slackChannelId, start, end),   // Count members who left
    countMessagesBetween(config.slackChannelId, start, end),         // Count messages
    countFileUploadsBetween(config.slackChannelId, start, end),      // Count file uploads
  ]);

  // Return a summary object with all the counts
  return {
    channelId: config.slackChannelId,  // Which channel
    statDate,                           // Which date (YYYY-MM-DD)
    reactionCount,                      // Total reactions
    newMemberCount,                     // New members
    memberRemovedCount,                 // Members who left
    messageCount,                       // Total messages
    fileUploadCount,                    // Total file uploads
  };
}

/**
 * Save the summary to the database
 * This stores the summary results so we have a history
 * 
 * @param {object} summary - The summary object from collectStatsForDate
 * @param {string} messageTs - Slack message timestamp (when we posted it to Slack)
 * @returns {object} - The saved summary record from database
 */
async function persistSummary(summary, messageTs) {
  // Call saveDailySummary to store it in the database
  return saveDailySummary({
    channelId: summary.channelId,
    statDate: summary.statDate,
    reactionCount: summary.reactionCount,
    newMemberCount: summary.newMemberCount,
    memberRemovedCount: summary.memberRemovedCount,
    messageCount: summary.messageCount,
    fileUploadCount: summary.fileUploadCount,
    messageTs,  // Slack message timestamp (so we know which Slack message this summary is)
  });
}

// Export functions so other files can use them
module.exports = {
  collectStatsForDate,  // Main function to collect stats for a date
  persistSummary,       // Function to save summary to database
  getDayRange,          // Helper function to get date range
};
