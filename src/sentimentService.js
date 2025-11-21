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
const { slackClient } = require('./slackClient');

// Initialize the sentiment engine once (cheap to reuse)
const sentimentEngine = new Sentiment();

// Simple emoji buckets that influence the overall score
const POSITIVE_REACTIONS = new Set(['thumbsup', 'heart', 'clap', 'smile', 'grinning', 'tada', 'white_check_mark', 'rocket']);
const NEGATIVE_REACTIONS = new Set(['thumbsdown', 'rage', 'angry', 'cry', 'sob', 'confused', 'broken_heart']);

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

    if (POSITIVE_REACTIONS.has(name)) {
      reactionScore += count * 0.5; // modest boost
    } else if (NEGATIVE_REACTIONS.has(name)) {
      reactionScore -= count * 0.5; // modest penalty
    }

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
  const response = await slackClient.conversations.replies({
    channel: channelId,
    ts: rootTs,
    inclusive: true,
    limit: 50,
  });

  return response.messages || [];
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
          text: '⚠️ *Unable to calculate sentiment right now.*',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Reason: \`${errorMessage}\``,
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
  const { mood, combinedScore, textScore, reactionScore, reactionSummaryText, messageAnalyses, analyzedMessageCount } =
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
    blocks: [
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
      },
    ],
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
    const [threadMessages, reactions] = await Promise.all([
      fetchThreadMessages(channelId, rootTs),
      fetchRootReactions(channelId, rootTs),
    ]);

    const analysis = analyzeThreadSentiment(threadMessages, reactions);
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

