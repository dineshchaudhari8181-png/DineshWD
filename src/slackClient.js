/**
 * SLACK_CLIENT.JS - Slack Message Posting
 * 
 * This file handles posting messages to Slack using the Slack Web API.
 * It formats the daily summary into a nice-looking message using Slack Block Kit.
 * 
 * Block Kit is Slack's way of creating rich, formatted messages with:
 * - Headers
 * - Sections
 * - Tables
 * - Dividers
 * - etc.
 */

// Import Slack Web API client
const { WebClient } = require('@slack/web-api');
// Import config to get bot token and channel ID
const config = require('./config');

// Check if bot token is configured
if (!config.slackBotToken) {
  console.warn('⚠️  SLACK_BOT_TOKEN is not set. Slack messages cannot be sent.');
}

// Create a Slack client instance
// This is used to send messages to Slack
const slackClient = new WebClient(config.slackBotToken);

/**
 * Build Slack Block Kit blocks for the daily summary message
 * Block Kit is Slack's format for creating rich, formatted messages
 * 
 * @param {object} summary - Summary data with all the counts
 * @returns {array} - Array of Block Kit blocks
 * 
 * The message will look like:
 * ┌─────────────────────────────────┐
 * │ 📊 Daily Channel Summary - 2024-01-15 │
 * ├─────────────────────────────────┤
 * │ 📋 Activity Statistics Table    │
 * │                                 │
 * │ Metric          │ Count         │
 * │ Messages Sent   │ 150           │
 * │ Reactions       │ 25            │
 * │ File Uploads    │ 5             │
 * │ New Members     │ 3             │
 * │ Members Removed │ 1             │
 * │ ────────────────                │
 * │ Total Activity  │ 180           │
 * └─────────────────────────────────┘
 */
function buildSummaryBlocks(summary) {
  // Extract values from summary object
  const { statDate, reactionCount, newMemberCount, memberRemovedCount, messageCount, fileUploadCount } = summary;
  
  // Helper function to format numbers with commas (e.g., 1000 → "1,000")
  const formatNumber = (num) => num.toLocaleString();
  
  // Calculate total activity (messages + reactions + files)
  const totalActivity = messageCount + reactionCount + fileUploadCount;
  
  // Return array of Block Kit blocks
  // Each block is a different part of the message
  return [
    // Block 1: Header (title)
    {
      type: 'header',  // Header block type (big, bold text)
      text: {
        type: 'plain_text',  // Plain text (no formatting)
        text: `📊 Daily Channel Summary - ${statDate}`,  // The header text
      },
    },
    
    // Block 2: Divider (horizontal line)
    {
      type: 'divider',  // Just a horizontal line to separate sections
    },
    
    // Block 3: Section title
    {
      type: 'section',  // Section block (can contain text, fields, etc.)
      text: {
        type: 'mrkdwn',  // Markdown text (supports *bold*, _italic_, etc.)
        text: '*📋 Activity Statistics Table*',  // Bold text
      },
    },
    
    // Block 4: Table with statistics
    {
      type: 'section',  // Another section block
      fields: [  // Fields create a two-column layout
        {
          type: 'mrkdwn',  // Left column: Metric names
          text: `*Metric*\n💬 Messages Sent\n👍 Reactions Added\n📎 File Uploads\n👥 New Members\n👋 Members Removed\n━━━━━━━━━━━━━━━━\n📊 *Total Activity*`,
          // \n means new line
          // ━━━ creates a separator line
        },
        {
          type: 'mrkdwn',  // Right column: Counts
          text: `*Count*\n\`${formatNumber(messageCount)}\`\n\`${formatNumber(reactionCount)}\`\n\`${formatNumber(fileUploadCount)}\`\n\`${formatNumber(newMemberCount)}\`\n\`${formatNumber(memberRemovedCount)}\`\n━━━━━━━━━━━━━━━━\n\`*${formatNumber(totalActivity)}*\``,
          // \` creates code formatting (monospace font)
          // * makes text bold
        },
      ],
    },
    
    // Block 5: Footer (context)
    {
      type: 'context',  // Context block (small text at bottom)
      elements: [
        {
          type: 'mrkdwn',
          text: `⏰ Generated automatically • Date: ${statDate}`,  // Footer text
        },
      ],
    },
  ];
}

/**
 * Post the daily summary to Slack
 * 
 * @param {object} summary - Summary data with all counts
 * @returns {string|null} - Slack message timestamp (ts) or null if failed
 * 
 * The message timestamp (ts) is like a unique ID for the message.
 * We save it to the database so we can reference this message later.
 */
async function postSummary(summary) {
  if (!config.slackBotToken) {
    console.warn('⚠️  SLACK_BOT_TOKEN is not set. Slack messages cannot be sent.');
    return null;
  }

  // Build the Block Kit blocks (the formatted message)
  const blocks = buildSummaryBlocks(summary);
  
  // Create a plain text fallback (for notifications, accessibility, etc.)
  // This is shown if Block Kit rendering fails or in notifications
  const text = `Daily summary for ${summary.statDate}: ${summary.messageCount} messages, ${summary.reactionCount} reactions, ${summary.fileUploadCount} files, ${summary.newMemberCount} new members, ${summary.memberRemovedCount} members removed.`;

  // Send the message to Slack using the Web API
  const targetChannel = summary.channelId || config.slackChannelId;
  if (!targetChannel) {
    console.warn('⚠️  No channel provided for summary post.');
    return null;
  }

  const response = await slackClient.chat.postMessage({
    channel: targetChannel,
    text,                             // Plain text fallback
    blocks,                           // Block Kit formatted message
  });

  // Return the message timestamp (ts)
  // This is like a unique ID for the message (e.g., "1234567890.123456")
  return response.ts;
}

// Export the function so other files can use it
module.exports = {
  postSummary,  // Function to post summary to Slack
};
