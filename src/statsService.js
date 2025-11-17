const {
  countReactionsBetween,
  countNewMembersBetween,
  countMembersRemovedBetween,
  countMessagesBetween,
  countFileUploadsBetween,
  saveDailySummary,
} = require('./eventsStore');
const config = require('./config');

function getDayRange(targetDate) {
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

async function collectStatsForDate(targetDate) {
  if (!config.slackChannelId) {
    throw new Error('SLACK_CHANNEL_ID is not configured.');
  }

  const statDate = targetDate.toISOString().slice(0, 10);
  const { start, end } = getDayRange(targetDate);

  const [reactionCount, newMemberCount, memberRemovedCount, messageCount, fileUploadCount] = await Promise.all([
    countReactionsBetween(config.slackChannelId, start, end),
    countNewMembersBetween(config.slackChannelId, start, end),
    countMembersRemovedBetween(config.slackChannelId, start, end),
    countMessagesBetween(config.slackChannelId, start, end),
    countFileUploadsBetween(config.slackChannelId, start, end),
  ]);

  return {
    channelId: config.slackChannelId,
    statDate,
    reactionCount,
    newMemberCount,
    memberRemovedCount,
    messageCount,
    fileUploadCount,
  };
}

async function persistSummary(summary, messageTs) {
  return saveDailySummary({
    channelId: summary.channelId,
    statDate: summary.statDate,
    reactionCount: summary.reactionCount,
    newMemberCount: summary.newMemberCount,
    memberRemovedCount: summary.memberRemovedCount,
    messageCount: summary.messageCount,
    fileUploadCount: summary.fileUploadCount,
    messageTs,
  });
}

module.exports = {
  collectStatsForDate,
  persistSummary,
  getDayRange,
};

