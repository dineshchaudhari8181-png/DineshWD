const { WebClient } = require('@slack/web-api');
const config = require('./config');

if (!config.slackBotToken) {
  console.warn('⚠️  SLACK_BOT_TOKEN is not set. Slack messages cannot be sent.');
}

const slackClient = new WebClient(config.slackBotToken);

function buildSummaryBlocks(summary) {
  const { statDate, reactionCount, newMemberCount, memberRemovedCount, messageCount, fileUploadCount } = summary;
  
  // Format numbers with commas for better readability
  const formatNumber = (num) => num.toLocaleString();
  const totalActivity = messageCount + reactionCount + fileUploadCount;
  
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📊 Daily Channel Summary - ${statDate}`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*📋 Activity Statistics Table*',
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Metric*\n💬 Messages Sent\n👍 Reactions Added\n📎 File Uploads\n👥 New Members\n👋 Members Removed\n━━━━━━━━━━━━━━━━\n📊 *Total Activity*`,
        },
        {
          type: 'mrkdwn',
          text: `*Count*\n\`${formatNumber(messageCount)}\`\n\`${formatNumber(reactionCount)}\`\n\`${formatNumber(fileUploadCount)}\`\n\`${formatNumber(newMemberCount)}\`\n\`${formatNumber(memberRemovedCount)}\`\n━━━━━━━━━━━━━━━━\n\`*${formatNumber(totalActivity)}*\``,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `⏰ Generated automatically • Date: ${statDate}`,
        },
      ],
    },
  ];
}

async function postSummary(summary) {
  if (!config.slackBotToken || !config.slackChannelId) {
    console.warn('Slack credentials missing. Skipping post.');
    return null;
  }

  const blocks = buildSummaryBlocks(summary);
  const text = `Daily summary for ${summary.statDate}: ${summary.messageCount} messages, ${summary.reactionCount} reactions, ${summary.fileUploadCount} files, ${summary.newMemberCount} new members, ${summary.memberRemovedCount} members removed.`;

  const response = await slackClient.chat.postMessage({
    channel: config.slackChannelId,
    text,
    blocks,
  });

  return response.ts;
}

module.exports = {
  postSummary,
};

