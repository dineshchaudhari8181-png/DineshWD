/**
 * SENTIMENTSERVICE.JS - Real-time sentiment analysis for Slack message shortcuts
 *
 * This module powers the "Sentiment Score" message shortcut:
 * 1. Slack sends the shortcut payload with a trigger_id and message context.
 * 2. We immediately open a lightweight "Analyzing..." modal so Slack doesn't timeout.
 * 3. We fetch the full thread + reactions, run sentiment analysis, and update the modal.
 * 4. Results are NOT stored in the database; everything happens on-demand.
 */

const Sentiment = require('sentiment');
const emojiSentimentDataset = require('emoji-sentiment');
const emoji = require('node-emoji');
const { slackClient } = require('./slackClient');

// Initialize the sentiment engine once (cheap to reuse)
const sentimentEngine = new Sentiment();

// Build a lookup map of emoji character -> sentiment score from the dataset
const emojiScoreMap = new Map(
  emojiSentimentDataset.map((entry) => {
    const codePoints = entry.sequence.split('-').map((value) => parseInt(value, 16));
    const emojiChar = String.fromCodePoint(...codePoints);
    return [emojiChar, entry.score];
  })
);

// Some Slack reaction names don't match node-emoji's dictionary, so we provide aliases
const REACTION_ALIAS = {
  thumbsup: '👍',
  thumbsdown: '👎',
  '+1': '👍',
  '-1': '👎',
  simple_smile: '🙂',
  slightly_smiling_face: '🙂',
  white_check_mark: '✅',
  heavy_check_mark: '✔️',
};

function getEmojiCharacterFromReaction(name = '') {
  if (!name) {
    return null;
  }
  const normalized = name.toLowerCase();
  const baseName = normalized.split('::')[0]; // strip skin tone modifiers if present
  return emoji.get(baseName) || REACTION_ALIAS[baseName] || null;
}

function getReactionSentimentDelta(name, count = 0) {
  const emojiChar = getEmojiCharacterFromReaction(name);
  if (!emojiChar) {
    return 0;
  }

  const score = emojiScoreMap.get(emojiChar);
  if (typeof score !== 'number') {
    return 0;
  }

  // Multiply by reaction count so each user reaction contributes to the adjustment
  return score * count;
}

/**
 * Ensure we trim text for modal display (Slack recommends keeping sections short).
 */
function trimText(text = '', max = 180) {
  const normalized = text.trim();
  if (normalized.length <= max) {
    return normalized || 'No text content detected.';
  }
  return `${normalized.slice(0, max - 3)}...`;
}

function formatUser(userId) {
  return userId ? `<@${userId}>` : 'Someone';
}

/**
 * Classify the combined sentiment score into human-friendly labels.
 */
function classifyMood(score) {
  if (score >= 3) {
    return { label: 'Positive', emoji: '😄', color: '#2EB67D' };
  }
  if (score <= -3) {
    return { label: 'Negative', emoji: '😟', color: '#E01E5A' };
  }
  return { label: 'Neutral', emoji: '😐', color: '#ECB22E' };
}

/**
 * Score reactions to provide a tiny boost/penalty to the sentiment score.
 */
function summarizeReactions(reactions = []) {
  if (!Array.isArray(reactions) || reactions.length === 0) {
    return { reactionScore: 0, summaryText: 'No reactions yet.' };
  }

  let reactionScore = 0;
  const summaryParts = reactions.slice(0, 8).map((reaction) => {
    const name = reaction.name || 'reaction';
    const count = reaction.count || 0;
    reactionScore += getReactionSentimentDelta(name, count);

    return `:${name}: ×${count}`;
  });

  return {
    reactionScore,
    summaryText: summaryParts.join(' • '),
  };
}

/**
 * Run sentiment analysis over every message in the thread (root + replies).
 */
function analyzeThreadSentiment(messages = [], reactions = []) {
  const messageAnalyses = [];
  let textScore = 0;

  messages.forEach((message) => {
    const text = message?.text?.trim();
    if (!text) {
      return;
    }

    const result = sentimentEngine.analyze(text);
    textScore += result.score;

    messageAnalyses.push({
      ts: message.ts,
      text: text,
      snippet: trimText(text),
      score: result.score,
      comparative: result.comparative,
      userId: message.user,
      isRoot: message.thread_ts ? message.ts === message.thread_ts : false,
    });
  });

  const { reactionScore, summaryText } = summarizeReactions(reactions);
  const combinedScore = textScore + reactionScore;
  const mood = classifyMood(combinedScore);

  return {
    textScore,
    reactionScore,
    combinedScore,
    mood,
    reactionSummaryText: summaryText,
    messageAnalyses,
    analyzedMessageCount: messageAnalyses.length,
  };
}

async function fetchThreadMessages(channelId, rootTs) {
  try {
    const response = await slackClient.conversations.replies({
      channel: channelId,
      ts: rootTs,
      inclusive: true,
      limit: 50,
    });

    return response.messages || [];
  } catch (error) {
    // If bot is not in channel, we can't fetch thread messages
    if (error.data?.error === 'not_in_channel') {
      throw new Error('not_in_channel');
    }
    // For other errors, log and return empty array (we'll still analyze the root message)
    console.warn('⚠️  Unable to fetch thread messages:', error.message);
    return [];
  }
}

async function fetchRootReactions(channelId, rootTs) {
  try {
    const response = await slackClient.reactions.get({
      channel: channelId,
      timestamp: rootTs,
      full: true,
    });

    return response?.message?.reactions || [];
  } catch (error) {
    // Slack returns an error if the message has zero reactions or scope is missing.
    console.warn('⚠️  Unable to fetch reactions for sentiment modal:', error.message);
    return [];
  }
}

function buildLoadingView(rootMessage) {
  return {
    type: 'modal',
    callback_id: 'sentiment_score_loading',
    title: {
      type: 'plain_text',
      text: 'Sentiment Score',
    },
    close: {
      type: 'plain_text',
      text: 'Close',
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Analyzing conversation...*',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Message snippet:\n>${trimText(rootMessage.text, 120)}`,
          },
        ],
      },
    ],
  };
}

function buildErrorView(errorMessage, rootMessage) {
  // Special handling for "not_in_channel" error
  const isNotInChannel = errorMessage === 'not_in_channel';
  
  return {
    type: 'modal',
    callback_id: 'sentiment_score_error',
    title: {
      type: 'plain_text',
      text: 'Sentiment Score',
    },
    close: {
      type: 'plain_text',
      text: 'Close',
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: isNotInChannel
            ? '⚠️ *Bot not in channel*'
            : '⚠️ *Unable to calculate sentiment right now.*',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: isNotInChannel
            ? 'The bot needs to be added to this channel to analyze sentiment. Please invite <@DailyEngage> to the channel first.'
            : `Reason: \`${errorMessage}\``,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Original message: ${trimText(rootMessage.text, 120)}`,
          },
        ],
      },
    ],
  };
}

function buildResultView(rootMessage, analysis) {
  const { mood, combinedScore, textScore, reactionScore, reactionSummaryText, messageAnalyses, analyzedMessageCount, notInChannel } =
    analysis;

  const formattedCombined = combinedScore.toFixed(1);
  const formattedTextScore = textScore.toFixed(1);
  const formattedReactionScore = reactionScore >= 0 ? `+${reactionScore.toFixed(1)}` : reactionScore.toFixed(1);
  const replyBlocks = messageAnalyses.slice(0, 4).map((details, index) => ({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${details.isRoot ? 'Original message' : `Reply #${index}`}* by ${formatUser(details.userId)} • Score: ${
        details.score >= 0 ? `+${details.score}` : details.score
      }\n>${details.snippet}`,
    },
  }));

  // Build the blocks array
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${mood.emoji} *Overall mood:* ${mood.label}\n*Combined score:* ${formattedCombined}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Text score: ${formattedTextScore} • Reaction adjustment: ${formattedReactionScore} • ${analyzedMessageCount} messages analyzed`,
        },
      ],
    },
  ];

  // Add warning if bot is not in channel
  if (notInChannel) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '⚠️ *Limited analysis*: Bot is not in this channel. Only the original message was analyzed. Add the bot to see thread replies and reactions.',
      },
    });
  }

  blocks.push(
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Message preview*\n${trimText(rootMessage.text, 180)}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Posted by ${formatUser(rootMessage.userId)} in <#${rootMessage.channelId}>`,
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Reactions overview*\n${reactionSummaryText}`,
      },
    },
    {
      type: 'divider',
    },
    ...(replyBlocks.length
      ? replyBlocks
      : [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'No replies yet — sentiment is based only on the original message.',
            },
          },
        ]),
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '🔒 Sentiment is calculated on demand and not stored anywhere.',
        },
      ],
    }
  );

  return {
    type: 'modal',
    callback_id: 'sentiment_score_result',
    title: {
      type: 'plain_text',
      text: 'Sentiment Score',
    },
    close: {
      type: 'plain_text',
      text: 'Close',
    },
    blocks,
  };
}

/**
 * Main entry point invoked by server.js when Slack triggers the shortcut.
 */
async function handleSentimentShortcut(payload) {
  if (!payload) {
    throw new Error('Missing Slack payload.');
  }

  if (!slackClient) {
    throw new Error('Slack client is not initialized.');
  }

  const triggerId = payload.trigger_id;
  const channelId = payload.channel?.id || payload.message?.channel;
  const rootTs = payload.message?.thread_ts || payload.message?.ts;
  const rootMessage = {
    text: payload.message?.text || 'No text content',
    userId: payload.message?.user,
    channelId,
  };

  if (!triggerId || !channelId || !rootTs) {
    throw new Error('Slack payload missing trigger_id, channel, or message timestamp.');
  }

  // Open a quick loading modal to avoid Slack's 3-second timeout.
  const loadingView = buildLoadingView(rootMessage);
  let openedView;
  try {
    openedView = await slackClient.views.open({
      trigger_id: triggerId,
      view: loadingView,
    });
  } catch (error) {
    console.error('❌ Failed to open sentiment loading modal:', error);
    throw error;
  }

  const viewId = openedView?.view?.id;
  const viewHash = openedView?.view?.hash;

  try {
    let threadMessages = [];
    let reactions = [];
    let notInChannel = false;

    try {
      // Try to fetch thread messages and reactions
      [threadMessages, reactions] = await Promise.all([
        fetchThreadMessages(channelId, rootTs),
        fetchRootReactions(channelId, rootTs),
      ]);
    } catch (fetchError) {
      // If we can't fetch because bot is not in channel, try to analyze just the root message
      if (fetchError.message === 'not_in_channel') {
        notInChannel = true;
        // Create a minimal message object from the payload for analysis
        if (rootMessage.text && rootMessage.text !== 'No text content') {
          threadMessages = [
            {
              ts: rootTs,
              text: rootMessage.text,
              user: rootMessage.userId,
            },
          ];
        }
      } else {
        throw fetchError;
      }
    }

    // If we have at least the root message, analyze it
    if (threadMessages.length > 0) {
      const analysis = analyzeThreadSentiment(threadMessages, reactions);
      
      // If bot wasn't in channel, add a note to the result
      if (notInChannel) {
        analysis.notInChannel = true;
        analysis.limitedAnalysis = true;
      }
      
      const resultView = buildResultView(rootMessage, analysis);

      if (viewId) {
        await slackClient.views.update({
          view_id: viewId,
          hash: viewHash,
          view: resultView,
        });
      } else {
        await slackClient.views.open({
          trigger_id: triggerId,
          view: resultView,
        });
      }
    } else {
      // No message text available, show error
      throw new Error('not_in_channel');
    }
  } catch (error) {
    console.error('❌ Sentiment analysis failed:', error);
    const errorView = buildErrorView(error.message, rootMessage);

    if (viewId) {
      await slackClient.views.update({
        view_id: viewId,
        hash: viewHash,
        view: errorView,
      });
    } else {
      await slackClient.views.open({
        trigger_id: triggerId,
        view: errorView,
      });
    }
  }
}

module.exports = {
  handleSentimentShortcut,
};

