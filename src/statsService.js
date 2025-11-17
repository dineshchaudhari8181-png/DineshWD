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
 * Get the start and end times for a specific date
 * 
 * @param {Date} targetDate - The date we want to get the range for
 * @returns {object} - Object with start and end Date objects
 * 
 * Example: getDayRange(new Date('2024-01-15'))
 *          Returns: { start: Date(2024-01-15 00:00:00), end: Date(2024-01-15 23:59:59) }
 */
function getDayRange(targetDate) {
  // Create a new Date object for the start of the day
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);  // Set to 00:00:00.000 (midnight)

  // Create a new Date object for the end of the day
  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);  // Set to 23:59:59.999 (last millisecond of the day)

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

  // Convert date to YYYY-MM-DD format (e.g., "2024-01-15")
  // toISOString() returns "2024-01-15T00:00:00.000Z"
  // slice(0, 10) takes only the first 10 characters: "2024-01-15"
  const statDate = targetDate.toISOString().slice(0, 10);
  
  // Get the start and end times for this date
  const { start, end } = getDayRange(targetDate);

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
