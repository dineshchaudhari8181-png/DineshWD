/**
 * EVENTS_STORE.JS - Database Operations for Events
 * 
 * This file contains all functions that save events to the database and count events.
 * Think of it as the "database helper" file - it handles all SQL queries.
 * 
 * Functions in this file:
 * - Save functions: Save events to database (reactions, messages, files, members)
 * - Count functions: Count how many events happened in a time range
 * - Summary function: Save the daily summary results
 */

// Import the database connection pool from db.js
const { pool } = require('./db');

/**
 * Save a reaction event to the database
 * Called when someone adds an emoji reaction to a message
 * 
 * @param {object} params - Reaction event data
 * @param {string} params.eventId - Unique event ID from Slack
 * @param {string} params.channelId - Channel where reaction was added
 * @param {string} params.userId - Who added the reaction
 * @param {string} params.reaction - Which emoji (e.g., "thumbsup")
 * @param {Date} params.eventTs - When it happened
 * @param {object} params.rawEvent - Full event data from Slack
 */
async function saveReactionEvent({ eventId, channelId, userId, reaction, eventTs, rawEvent }) {
  // SQL query to insert a new reaction event
  // $1, $2, $3, etc. are placeholders that will be replaced with actual values
  // This prevents SQL injection attacks (security)
  const query = `
    INSERT INTO reaction_events (event_id, channel_id, user_id, reaction, event_ts, raw_event)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (event_id) DO NOTHING
  `;
  // ON CONFLICT means: if event_id already exists, don't insert (prevents duplicates)

  // Execute the query with the actual values
  // pool.query() runs the SQL query against the database
  await pool.query(query, [eventId, channelId, userId, reaction, eventTs, rawEvent]);
}

/**
 * Save a member event (join or leave) to the database
 * 
 * @param {object} params - Member event data
 * @param {string} params.eventId - Unique event ID
 * @param {string} params.channelId - Channel ID
 * @param {string} params.userId - Who joined/left
 * @param {string} params.eventType - "member_joined_channel" or "member_left_channel"
 * @param {Date} params.eventTs - When it happened
 * @param {object} params.rawEvent - Full event data
 */
async function saveMemberEvent({ eventId, channelId, userId, eventType, eventTs, rawEvent }) {
  const query = `
    INSERT INTO member_events (event_id, channel_id, user_id, event_type, event_ts, raw_event)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (event_id) DO NOTHING
  `;

  await pool.query(query, [eventId, channelId, userId, eventType, eventTs, rawEvent]);
}

/**
 * Save a message event to the database
 * 
 * @param {object} params - Message event data
 * @param {string} params.eventId - Unique event ID
 * @param {string} params.channelId - Channel ID
 * @param {string} params.userId - Who sent the message
 * @param {Date} params.eventTs - When it was sent
 * @param {object} params.rawEvent - Full message data
 */
async function saveMessageEvent({ eventId, channelId, userId, eventTs, rawEvent }) {
  const query = `
    INSERT INTO message_events (event_id, channel_id, user_id, message_ts, raw_event)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (event_id) DO NOTHING
  `;

  await pool.query(query, [eventId, channelId, userId, eventTs, rawEvent]);
}

/**
 * Save a file upload event to the database
 * 
 * @param {object} params - File event data
 * @param {string} params.eventId - Unique event ID
 * @param {string} params.channelId - Channel ID
 * @param {string} params.userId - Who uploaded the file
 * @param {string} params.fileId - Slack's file ID
 * @param {string} params.fileName - Name of the file
 * @param {Date} params.eventTs - When it was uploaded
 * @param {object} params.rawEvent - Full event data
 */
async function saveFileEvent({ eventId, channelId, userId, fileId, fileName, eventTs, rawEvent }) {
  const query = `
    INSERT INTO file_events (event_id, channel_id, user_id, file_id, file_name, event_ts, raw_event)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (event_id) DO NOTHING
  `;

  await pool.query(query, [eventId, channelId, userId, fileId, fileName, eventTs, rawEvent]);
}

/**
 * Count how many reactions were added between two dates
 * Used when generating the daily summary
 * 
 * @param {string} channelId - Which channel to count
 * @param {Date} start - Start date/time
 * @param {Date} end - End date/time
 * @returns {number} - Total number of reactions
 * 
 * Example: countReactionsBetween("C09SUH2KHK2", startOfDay, endOfDay)
 *          Returns: 15 (if 15 reactions were added that day)
 */
async function countReactionsBetween(channelId, start, end) {
  // SQL query to count rows
  // COUNT(*) counts all rows that match the WHERE conditions
  const query = `
    SELECT COUNT(*) AS total
    FROM reaction_events
    WHERE channel_id = $1              -- Only this channel
      AND event_ts >= $2               -- After start time
      AND event_ts <= $3               -- Before end time
  `;

  // Execute query and get results
  const { rows } = await pool.query(query, [channelId, start, end]);
  // rows[0] is the first (and only) row
  // rows[0].total is the count
  // Convert to number and return (or 0 if no results)
  return Number(rows[0]?.total || 0);
}

/**
 * Count how many new members joined between two dates
 * 
 * @param {string} channelId - Which channel
 * @param {Date} start - Start date/time
 * @param {Date} end - End date/time
 * @returns {number} - Total number of new members
 */
async function countNewMembersBetween(channelId, start, end) {
  const query = `
    SELECT COUNT(*) AS total
    FROM member_events
    WHERE channel_id = $1
      AND event_type = 'member_joined_channel'  -- Only count joins, not leaves
      AND event_ts >= $2
      AND event_ts <= $3
  `;

  const { rows } = await pool.query(query, [channelId, start, end]);
  return Number(rows[0]?.total || 0);
}

/**
 * Count how many members left between two dates
 * 
 * @param {string} channelId - Which channel
 * @param {Date} start - Start date/time
 * @param {Date} end - End date/time
 * @returns {number} - Total number of members who left
 */
async function countMembersRemovedBetween(channelId, start, end) {
  const query = `
    SELECT COUNT(*) AS total
    FROM member_events
    WHERE channel_id = $1
      AND event_type = 'member_left_channel'    -- Only count leaves
      AND event_ts >= $2
      AND event_ts <= $3
  `;

  const { rows } = await pool.query(query, [channelId, start, end]);
  return Number(rows[0]?.total || 0);
}

/**
 * Count how many messages were sent between two dates
 * 
 * @param {string} channelId - Which channel
 * @param {Date} start - Start date/time
 * @param {Date} end - End date/time
 * @returns {number} - Total number of messages
 */
async function countMessagesBetween(channelId, start, end) {
  const query = `
    SELECT COUNT(*) AS total
    FROM message_events
    WHERE channel_id = $1
      AND message_ts >= $2
      AND message_ts <= $3
  `;

  const { rows } = await pool.query(query, [channelId, start, end]);
  return Number(rows[0]?.total || 0);
}

/**
 * Count how many files were uploaded between two dates
 * 
 * @param {string} channelId - Which channel
 * @param {Date} start - Start date/time
 * @param {Date} end - End date/time
 * @returns {number} - Total number of file uploads
 */
async function countFileUploadsBetween(channelId, start, end) {
  const query = `
    SELECT COUNT(*) AS total
    FROM file_events
    WHERE channel_id = $1
      AND event_ts >= $2
      AND event_ts <= $3
  `;

  const { rows } = await pool.query(query, [channelId, start, end]);
  return Number(rows[0]?.total || 0);
}

/**
 * Save the daily summary to the database
 * This stores the summary results so we have a history of all summaries
 * 
 * @param {object} params - Summary data
 * @param {string} params.channelId - Channel ID
 * @param {string} params.statDate - Date in YYYY-MM-DD format
 * @param {number} params.reactionCount - Total reactions
 * @param {number} params.newMemberCount - New members
 * @param {number} params.memberRemovedCount - Members who left
 * @param {number} params.messageCount - Total messages
 * @param {number} params.fileUploadCount - Total file uploads
 * @param {string} params.messageTs - Slack message timestamp (if posted)
 * @returns {object} - The saved summary record
 */
async function saveDailySummary({ channelId, statDate, reactionCount, newMemberCount, memberRemovedCount, messageCount, fileUploadCount, messageTs }) {
  const query = `
    INSERT INTO daily_summaries (
      channel_id, stat_date, reaction_count, new_member_count, 
      member_removed_count, message_count, file_upload_count, message_ts
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (channel_id, stat_date) DO UPDATE
      -- If a summary for this channel+date already exists, update it instead
      SET reaction_count = EXCLUDED.reaction_count,
          new_member_count = EXCLUDED.new_member_count,
          member_removed_count = EXCLUDED.member_removed_count,
          message_count = EXCLUDED.message_count,
          file_upload_count = EXCLUDED.file_upload_count,
          message_ts = COALESCE(EXCLUDED.message_ts, daily_summaries.message_ts)
    RETURNING *
  `;
  // RETURNING * means: return the saved/updated record

  // Execute query with all the values
  const { rows } = await pool.query(query, [
    channelId,
    statDate,
    reactionCount,
    newMemberCount,
    memberRemovedCount || 0,      // Use 0 if not provided
    messageCount || 0,            // Use 0 if not provided
    fileUploadCount || 0,         // Use 0 if not provided
    messageTs || null,            // Use null if not provided
  ]);

  // Return the first (and only) row
  return rows[0];
}

// Export all functions so other files can use them
module.exports = {
  saveReactionEvent,           // Save reaction to database
  saveMemberEvent,             // Save member join/leave to database
  saveMessageEvent,            // Save message to database
  saveFileEvent,               // Save file upload to database
  countReactionsBetween,       // Count reactions in date range
  countNewMembersBetween,      // Count new members in date range
  countMembersRemovedBetween,  // Count members who left in date range
  countMessagesBetween,        // Count messages in date range
  countFileUploadsBetween,     // Count file uploads in date range
  saveDailySummary,            // Save summary results to database
};
