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
const config = require('./config');

// Gemini AI integration (optional fallback for advanced sentiment analysis)
let geminiClient = null;
console.log('\n🤖 ========================================');
console.log('🤖 Gemini AI Initialization');
console.log('🤖 ========================================');
if (config.geminiApiKey) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    geminiClient = new GoogleGenerativeAI(config.geminiApiKey);
    console.log('✅ Gemini API Key: SET');
    console.log(`✅ Gemini Model: ${config.geminiModel}`);
    console.log('✅ Gemini AI initialized successfully');
    console.log('✅ Will use Gemini as fallback when Node.js sentiment returns 0');
  } catch (error) {
    console.warn('⚠️  Gemini AI package not available, will use Node.js sentiment only');
    console.warn(`⚠️  Error: ${error.message}`);
  }
} else {
  console.log('⚠️  Gemini API Key: NOT SET');
  console.log('⚠️  Will use Node.js sentiment only (no Gemini fallback)');
  console.log('⚠️  To enable Gemini, set GEMINI_API_KEY in environment variables');
}
console.log('🤖 ========================================\n');

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

/**
 * Convert a Slack reaction name to its Unicode emoji character
 * 
 * Slack reactions use names like "thumbsup", "+1", "smile", etc.
 * This function converts those names to actual emoji characters (👍, 😊, etc.)
 * 
 * @param {string} name - Slack reaction name (e.g., "thumbsup", "+1", "smile")
 * @returns {string|null} - Unicode emoji character (e.g., "👍") or null if not found
 * 
 * @example
 * getEmojiCharacterFromReaction("thumbsup")  // Returns "👍"
 * getEmojiCharacterFromReaction("+1")        // Returns "👍"
 * getEmojiCharacterFromReaction("unknown")   // Returns null
 */
function getEmojiCharacterFromReaction(name = '') {
  if (!name) {
    return null;
  }
  const normalized = name.toLowerCase();
  const baseName = normalized.split('::')[0]; // strip skin tone modifiers if present
  return emoji.get(baseName) || REACTION_ALIAS[baseName] || null;
}

/**
 * Calculate sentiment score contribution from a reaction
 * 
 * Each emoji has a sentiment score (positive, negative, or neutral).
 * This function multiplies the emoji's base score by the number of times it was used.
 * 
 * @param {string} name - Slack reaction name (e.g., "thumbsup", "heart")
 * @param {number} count - Number of times this reaction was used (default: 0)
 * @returns {number} - Sentiment score contribution (positive, negative, or 0)
 * 
 * @example
 * getReactionSentimentDelta("thumbsup", 5)  // Returns positive score × 5
 * getReactionSentimentDelta("heart", 3)     // Returns positive score × 3
 * getReactionSentimentDelta("unknown", 2)   // Returns 0 (emoji not in dataset)
 */
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
 * Trim text to a maximum length for display in Slack modals
 * 
 * Slack modals have limited space, so we need to truncate long messages.
 * This function ensures text fits within the modal display.
 * 
 * @param {string} text - Text to trim
 * @param {number} max - Maximum length (default: 180 characters)
 * @returns {string} - Trimmed text with "..." if truncated, or fallback message if empty
 * 
 * @example
 * trimText("This is a very long message...", 20)  // Returns "This is a very lo..."
 * trimText("Short", 20)                          // Returns "Short"
 * trimText("", 20)                               // Returns "No text content detected."
 */
function trimText(text = '', max = 180) {
  const normalized = text.trim();
  if (normalized.length <= max) {
    return normalized || 'No text content detected.';
  }
  return `${normalized.slice(0, max - 3)}...`;
}

/**
 * Format a Slack user ID for display in messages
 * 
 * Converts a user ID (e.g., "U12345") to a Slack mention format (e.g., "<@U12345>")
 * When displayed in Slack, this will show as the user's name and be clickable.
 * 
 * @param {string} userId - Slack user ID (e.g., "U12345")
 * @returns {string} - Formatted user mention (e.g., "<@U12345>") or "Someone" if no ID
 * 
 * @example
 * formatUser("U12345")  // Returns "<@U12345>"
 * formatUser(null)      // Returns "Someone"
 */
function formatUser(userId) {
  return userId ? `<@${userId}>` : 'Someone';
}

/**
 * Classify a sentiment score into a human-friendly mood label
 * 
 * Converts a numeric sentiment score into a category (Positive, Negative, Neutral)
 * with an emoji and color for display in the modal.
 * 
 * @param {number} score - Combined sentiment score (can be positive, negative, or zero)
 * @returns {object} - Object with label, emoji, and color
 *   - label: "Positive" (score >= 3), "Negative" (score <= -3), or "Neutral" (otherwise)
 *   - emoji: Corresponding emoji (😄, 😟, or 😐)
 *   - color: Hex color code for display
 * 
 * @example
 * classifyMood(5)   // Returns { label: "Positive", emoji: "😄", color: "#2EB67D" }
 * classifyMood(-4)  // Returns { label: "Negative", emoji: "😟", color: "#E01E5A" }
 * classifyMood(0)   // Returns { label: "Neutral", emoji: "😐", color: "#ECB22E" }
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
 * Calculate total sentiment score from all reactions and create a summary text
 * 
 * Iterates through all reactions on a message, calculates their sentiment contribution,
 * and creates a human-readable summary (e.g., ":thumbsup: ×5 • :heart: ×3").
 * 
 * @param {array} reactions - Array of reaction objects from Slack
 *   Each reaction has: { name: string, count: number }
 * @returns {object} - Object with:
 *   - reactionScore: Total sentiment score from all reactions (number)
 *   - summaryText: Human-readable summary (e.g., ":thumbsup: ×5 • :heart: ×3")
 * 
 * @example
 * summarizeReactions([
 *   { name: "thumbsup", count: 5 },
 *   { name: "heart", count: 3 }
 * ])
 * // Returns: { reactionScore: 8.5, summaryText: ":thumbsup: ×5 • :heart: ×3" }
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
 * Analyze sentiment using Google Gemini AI as a fallback
 * 
 * This function is called when the Node.js sentiment library returns 0 or very low confidence.
 * Gemini AI can better understand context, slang, and stretched words (e.g., "sooooo badddddddddd").
 * 
 * @param {string} text - Message text to analyze
 * @param {string} context - Optional context (e.g., other messages in thread)
 * @returns {Promise<number>} - Sentiment score (-3 to +3 scale, similar to Node.js sentiment)
 * 
 * @example
 * await analyzeWithGemini("sooooo badddddddddd", "Previous message context")
 * // Returns: -2.5 (negative sentiment)
 */
async function analyzeWithGemini(text, context = '') {
  if (!geminiClient || !config.geminiApiKey) {
    console.log('⚠️  Gemini AI not configured, skipping Gemini analysis');
    return 0; // Return 0 if Gemini is not configured
  }

  try {
    const model = geminiClient.getGenerativeModel({ model: config.geminiModel });
    
    // Build prompt for Gemini
    const prompt = `Analyze the sentiment of this message and return ONLY a number from -3 to +3:
- +3 = Very positive
- +2 = Positive
- +1 = Slightly positive
- 0 = Neutral
- -1 = Slightly negative
- -2 = Negative
- -3 = Very negative

${context ? `Context from conversation: ${context}\n\n` : ''}Message: "${text}"

Return ONLY the number, nothing else.`;

    console.log('\n🤖 ========================================');
    console.log('🤖 Gemini AI Analysis Request');
    console.log('🤖 ========================================');
    console.log(`🤖 Model: ${config.geminiModel}`);
    console.log(`🤖 Message: "${trimText(text, 100)}"`);
    if (context) {
      console.log(`🤖 Context: "${trimText(context, 100)}"`);
    }
    console.log('🤖 Sending request to Gemini API...');

    const result = await model.generateContent(prompt);
    const response = result.response;
    const geminiText = response.text().trim();
    
    console.log('🤖 ========================================');
    console.log('🤖 Gemini AI Response');
    console.log('🤖 ========================================');
    console.log(`🤖 Raw Response: "${geminiText}"`);
    
    // Extract number from response
    const score = parseFloat(geminiText);
    
    if (Number.isNaN(score)) {
      console.warn(`⚠️  Gemini returned non-numeric value: "${geminiText}", using 0`);
      console.log('🤖 ========================================\n');
      return 0;
    }
    
    // Clamp score to -3 to +3 range
    const clampedScore = Math.max(-3, Math.min(3, score));
    console.log(`🤖 Parsed Score: ${score}`);
    console.log(`🤖 Final Score (clamped): ${clampedScore}`);
    console.log(`🤖 Analysis: "${trimText(text, 50)}" → Score: ${clampedScore >= 0 ? `+${clampedScore}` : clampedScore}`);
    console.log('🤖 ========================================\n');
    
    return clampedScore;
  } catch (error) {
    console.error('\n❌ ========================================');
    console.error('❌ Gemini AI Analysis Failed');
    console.error('❌ ========================================');
    console.error(`❌ Error: ${error.message}`);
    console.error(`❌ Message: "${trimText(text, 100)}"`);
    if (error.stack) {
      console.error(`❌ Stack: ${error.stack}`);
    }
    console.error('❌ ========================================\n');
    return 0; // Return 0 on error (fallback to neutral)
  }
}

/**
 * Analyze sentiment for all messages in a thread (root message + all replies)
 * 
 * This is the core sentiment analysis function. It:
 * 1. Analyzes each message's text using the sentiment library
 * 2. Uses Gemini AI as fallback for messages that score 0 or have low confidence
 * 3. Calculates reaction sentiment scores
 * 4. Combines text and reaction scores
 * 5. Classifies the overall mood
 * 
 * @param {array} messages - Array of message objects from Slack thread
 *   Each message has: { text: string, ts: string, user: string, thread_ts?: string }
 * @param {array} reactions - Array of reaction objects on the root message
 *   Each reaction has: { name: string, count: number }
 * @returns {Promise<object>} - Analysis results object with:
 *   - textScore: Total sentiment score from all message text (number)
 *   - reactionScore: Total sentiment score from reactions (number)
 *   - combinedScore: Sum of textScore + reactionScore (number)
 *   - mood: Mood classification object { label, emoji, color }
 *   - reactionSummaryText: Human-readable reaction summary (string)
 *   - messageAnalyses: Array of individual message analysis results
 *   - analyzedMessageCount: Number of messages analyzed (number)
 * 
 * @example
 * await analyzeThreadSentiment(
 *   [{ text: "Great work!", user: "U123", ts: "123.456" }],
 *   [{ name: "thumbsup", count: 3 }]
 * )
 * // Returns: { textScore: 3, reactionScore: 1.5, combinedScore: 4.5, mood: {...}, ... }
 */
async function analyzeThreadSentiment(messages = [], reactions = []) {
  const messageAnalyses = [];
  let textScore = 0;

  console.log('\n📊 ========================================');
  console.log('📊 Sentiment Analysis - Individual Messages');
  console.log('📊 ========================================');

  // Build context from all messages for Gemini (helps with understanding conversation flow)
  const allTexts = messages.map(m => m?.text?.trim()).filter(Boolean).join(' ');
  const context = allTexts.length > 200 ? allTexts.substring(0, 200) + '...' : allTexts;

  // Process each message
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    const text = message?.text?.trim();
    if (!text) {
      continue;
    }

    // First, try Node.js sentiment library
    const result = sentimentEngine.analyze(text);
    let finalScore = result.score;
    let usedGemini = false;

    // Use Gemini as fallback if:
    // 1. Score is 0 or very close to 0 (neutral/unclear) - Node.js sentiment couldn't determine sentiment
    // 2. Gemini is configured and available
    const shouldUseGemini = (finalScore === 0 || Math.abs(finalScore) < 0.1) && geminiClient && config.geminiApiKey;
    
    if (shouldUseGemini) {
      console.log(`  🔄 Node.js sentiment returned ${finalScore} (comparative: ${result.comparative}), trying Gemini AI...`);
      const geminiScore = await analyzeWithGemini(text, context);
      if (geminiScore !== 0) {
        finalScore = geminiScore;
        usedGemini = true;
        console.log(`  ✅ Gemini provided score: ${geminiScore >= 0 ? `+${geminiScore}` : geminiScore}`);
      } else {
        console.log(`  ⚠️  Gemini also returned 0, keeping Node.js sentiment score`);
      }
    } else if (finalScore === 0 || Math.abs(finalScore) < 0.1) {
      // Log why Gemini is NOT being used
      console.log(`  ⚠️  Node.js sentiment returned ${finalScore}, but Gemini is not available:`);
      if (!config.geminiApiKey) {
        console.log(`     - GEMINI_API_KEY is not set in environment variables`);
      } else if (!geminiClient) {
        console.log(`     - Gemini client failed to initialize`);
      }
    }

    textScore += finalScore;

    const isRoot = message.thread_ts ? message.ts === message.thread_ts : false;
    const messageType = isRoot ? 'Original Message' : `Reply #${index}`;
    const scoreDisplay = finalScore >= 0 ? `+${finalScore.toFixed(1)}` : finalScore.toFixed(1);
    const methodUsed = usedGemini ? ' (via Gemini AI)' : ' (via Node.js sentiment)';

    // Log each message and its score to console
    console.log(`\n${messageType}:`);
    console.log(`  User: ${message.user || 'Unknown'}`);
    console.log(`  Score: ${scoreDisplay}${methodUsed}`);
    console.log(`  Text: ${trimText(text, 100)}`);

    messageAnalyses.push({
      ts: message.ts,
      text: text,
      snippet: trimText(text),
      score: finalScore,
      comparative: result.comparative,
      userId: message.user,
      isRoot: isRoot,
      usedGemini: usedGemini,
    });
  }

  const { reactionScore, summaryText } = summarizeReactions(reactions);
  const combinedScore = textScore + reactionScore;
  const mood = classifyMood(combinedScore);

  // Log summary
  console.log('\n📊 ========================================');
  console.log('📊 Summary:');
  console.log(`📊 Total Messages Analyzed: ${messageAnalyses.length}`);
  console.log(`📊 Text Score: ${textScore >= 0 ? `+${textScore.toFixed(1)}` : textScore.toFixed(1)}`);
  console.log(`📊 Reaction Score: ${reactionScore >= 0 ? `+${reactionScore.toFixed(1)}` : reactionScore.toFixed(1)}`);
  console.log(`📊 Combined Score: ${combinedScore >= 0 ? `+${combinedScore.toFixed(1)}` : combinedScore.toFixed(1)}`);
  console.log(`📊 Overall Mood: ${mood.emoji} ${mood.label}`);
  console.log('📊 ========================================\n');

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

/**
 * Fetch all messages in a thread from Slack
 * 
 * Uses Slack Web API to retrieve the root message and all replies in a thread.
 * This requires the bot to be in the channel.
 * 
 * @param {string} channelId - Slack channel ID (e.g., "C09SUH2KHK2")
 * @param {string} rootTs - Root message timestamp (e.g., "1234567890.123456")
 * @returns {array} - Array of message objects from the thread
 * @throws {Error} - Throws "not_in_channel" error if bot is not in the channel
 * 
 * @example
 * await fetchThreadMessages("C09SUH2KHK2", "1234567890.123456")
 * // Returns: [{ text: "Hello", ts: "123.456", user: "U123", ... }, ...]
 */
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

/**
 * Fetch all reactions on the root message from Slack
 * 
 * Uses Slack Web API to retrieve all emoji reactions on a message.
 * Returns empty array if there are no reactions or if the API call fails.
 * 
 * @param {string} channelId - Slack channel ID (e.g., "C09SUH2KHK2")
 * @param {string} rootTs - Root message timestamp (e.g., "1234567890.123456")
 * @returns {array} - Array of reaction objects, or empty array if none/failed
 *   Each reaction has: { name: string, count: number, users: array }
 * 
 * @example
 * await fetchRootReactions("C09SUH2KHK2", "1234567890.123456")
 * // Returns: [{ name: "thumbsup", count: 5, users: [...] }, ...]
 */
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

/**
 * Build a Slack Block Kit modal view for the "loading" state
 * 
 * This modal is shown immediately when the user clicks the sentiment shortcut.
 * It displays "Analyzing..." while we fetch data and calculate sentiment.
 * 
 * @param {object} rootMessage - Root message object with text and userId
 *   - text: Message text content
 *   - userId: User who posted the message
 * @returns {object} - Slack Block Kit modal view object
 * 
 * @example
 * buildLoadingView({ text: "Hello world", userId: "U123" })
 * // Returns: { type: "modal", title: {...}, blocks: [...] }
 */
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

/**
 * Build a Slack Block Kit modal view for error states
 * 
 * This modal is shown when sentiment analysis fails (e.g., bot not in channel,
 * API errors, etc.). It displays a user-friendly error message.
 * 
 * @param {string} errorMessage - Error message or error code (e.g., "not_in_channel")
 * @param {object} rootMessage - Root message object with text and userId
 * @returns {object} - Slack Block Kit modal view object with error message
 * 
 * @example
 * buildErrorView("not_in_channel", { text: "Hello", userId: "U123" })
 * // Returns: { type: "modal", title: {...}, blocks: [error message blocks] }
 */
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

/**
 * Build a Slack Block Kit modal view displaying sentiment analysis results
 * 
 * This is the main result modal that shows:
 * - Overall mood (Positive/Negative/Neutral) with emoji
 * - Combined sentiment score
 * - Breakdown of text score vs reaction score
 * - Message preview
 * - Reactions overview
 * 
 * @param {object} rootMessage - Root message object
 *   - text: Message text content
 *   - userId: User who posted the message
 *   - channelId: Channel where message was posted
 * @param {object} analysis - Sentiment analysis results from analyzeThreadSentiment()
 *   - mood: Mood classification { label, emoji, color }
 *   - combinedScore: Total sentiment score
 *   - textScore: Score from message text
 *   - reactionScore: Score from reactions
 *   - reactionSummaryText: Human-readable reaction summary
 *   - analyzedMessageCount: Number of messages analyzed
 *   - notInChannel: Optional flag indicating limited analysis
 * @returns {object} - Slack Block Kit modal view object with results
 * 
 * @example
 * buildResultView(
 *   { text: "Great work!", userId: "U123", channelId: "C09SUH2KHK2" },
 *   { mood: { label: "Positive", emoji: "😄" }, combinedScore: 5, ... }
 * )
 * // Returns: { type: "modal", title: {...}, blocks: [result blocks] }
 */
function buildResultView(rootMessage, analysis) {
  const { mood, combinedScore, textScore, reactionScore, reactionSummaryText, analyzedMessageCount, notInChannel } =
    analysis;

  const formattedCombined = combinedScore.toFixed(1);
  const formattedTextScore = textScore.toFixed(1);
  const formattedReactionScore = reactionScore >= 0 ? `+${reactionScore.toFixed(1)}` : reactionScore.toFixed(1);

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
          text: `${analyzedMessageCount} messages analyzed`,
        },
      ],
    },
  ];

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
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '🔒 Sentiment is calculated on demand and not stored anywhere.',
        },
      ],
    }
  );

  // Add subtle warning at the bottom if bot is not in channel
  if (notInChannel) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '⚠️ Limited analysis: Bot not in channel. Only original message analyzed. Add bot for full thread & reactions.',
        },
      ],
    });
  }

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
 * Main entry point for sentiment analysis shortcut
 * 
 * This function is called by server.js when a user clicks the "Sentiment Score"
 * message shortcut in Slack. It orchestrates the entire sentiment analysis flow:
 * 
 * 1. Validates the payload and extracts message/channel info
 * 2. Opens a loading modal immediately (to avoid Slack's 3-second timeout)
 * 3. Fetches thread messages and reactions from Slack
 * 4. Performs sentiment analysis on all messages
 * 5. Updates the modal with results (or error message)
 * 
 * If the bot is not in the channel, it falls back to analyzing just the root message
 * from the payload (limited analysis).
 * 
 * @param {object} payload - Slack shortcut payload from the message action
 *   - trigger_id: Unique ID for opening the modal (required)
 *   - channel: Channel object with id (required)
 *   - message: Message object with text, ts, thread_ts, user (required)
 * @throws {Error} - Throws error if payload is invalid or missing required fields
 * 
 * @example
 * await handleSentimentShortcut({
 *   trigger_id: "123.456",
 *   channel: { id: "C09SUH2KHK2" },
 *   message: { text: "Hello", ts: "123.456", user: "U123" }
 * })
 * // Opens modal, analyzes sentiment, updates modal with results
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
      const analysis = await analyzeThreadSentiment(threadMessages, reactions);
      
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

