const { pool } = require('./db');

async function saveReactionEvent({ eventId, channelId, userId, reaction, eventTs, rawEvent }) {
  const query = `
    INSERT INTO reaction_events (event_id, channel_id, user_id, reaction, event_ts, raw_event)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (event_id) DO NOTHING
  `;

  await pool.query(query, [eventId, channelId, userId, reaction, eventTs, rawEvent]);
}

async function saveMemberEvent({ eventId, channelId, userId, eventType, eventTs, rawEvent }) {
  const query = `
    INSERT INTO member_events (event_id, channel_id, user_id, event_type, event_ts, raw_event)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (event_id) DO NOTHING
  `;

  await pool.query(query, [eventId, channelId, userId, eventType, eventTs, rawEvent]);
}

async function saveMessageEvent({ eventId, channelId, userId, eventTs, rawEvent }) {
  const query = `
    INSERT INTO message_events (event_id, channel_id, user_id, message_ts, raw_event)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (event_id) DO NOTHING
  `;

  await pool.query(query, [eventId, channelId, userId, eventTs, rawEvent]);
}

async function saveFileEvent({ eventId, channelId, userId, fileId, fileName, eventTs, rawEvent }) {
  const query = `
    INSERT INTO file_events (event_id, channel_id, user_id, file_id, file_name, event_ts, raw_event)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (event_id) DO NOTHING
  `;

  await pool.query(query, [eventId, channelId, userId, fileId, fileName, eventTs, rawEvent]);
}

async function countReactionsBetween(channelId, start, end) {
  const query = `
    SELECT COUNT(*) AS total
    FROM reaction_events
    WHERE channel_id = $1
      AND event_ts >= $2
      AND event_ts <= $3
  `;

  const { rows } = await pool.query(query, [channelId, start, end]);
  return Number(rows[0]?.total || 0);
}

async function countNewMembersBetween(channelId, start, end) {
  const query = `
    SELECT COUNT(*) AS total
    FROM member_events
    WHERE channel_id = $1
      AND event_type = 'member_joined_channel'
      AND event_ts >= $2
      AND event_ts <= $3
  `;

  const { rows } = await pool.query(query, [channelId, start, end]);
  return Number(rows[0]?.total || 0);
}

async function countMembersRemovedBetween(channelId, start, end) {
  const query = `
    SELECT COUNT(*) AS total
    FROM member_events
    WHERE channel_id = $1
      AND event_type = 'member_left_channel'
      AND event_ts >= $2
      AND event_ts <= $3
  `;

  const { rows } = await pool.query(query, [channelId, start, end]);
  return Number(rows[0]?.total || 0);
}

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

async function saveDailySummary({ channelId, statDate, reactionCount, newMemberCount, memberRemovedCount, messageCount, fileUploadCount, messageTs }) {
  const query = `
    INSERT INTO daily_summaries (
      channel_id, stat_date, reaction_count, new_member_count, 
      member_removed_count, message_count, file_upload_count, message_ts
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (channel_id, stat_date) DO UPDATE
      SET reaction_count = EXCLUDED.reaction_count,
          new_member_count = EXCLUDED.new_member_count,
          member_removed_count = EXCLUDED.member_removed_count,
          message_count = EXCLUDED.message_count,
          file_upload_count = EXCLUDED.file_upload_count,
          message_ts = COALESCE(EXCLUDED.message_ts, daily_summaries.message_ts)
    RETURNING *
  `;

  const { rows } = await pool.query(query, [
    channelId,
    statDate,
    reactionCount,
    newMemberCount,
    memberRemovedCount || 0,
    messageCount || 0,
    fileUploadCount || 0,
    messageTs || null,
  ]);

  return rows[0];
}

module.exports = {
  saveReactionEvent,
  saveMemberEvent,
  saveMessageEvent,
  saveFileEvent,
  countReactionsBetween,
  countNewMembersBetween,
  countMembersRemovedBetween,
  countMessagesBetween,
  countFileUploadsBetween,
  saveDailySummary,
};

