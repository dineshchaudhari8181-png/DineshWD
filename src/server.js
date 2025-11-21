/**
 * SERVER.JS - Main Server File
 * 
 * This is the main entry point of the application. It:
 * 1. Sets up the Express web server
 * 2. Handles incoming requests from Slack
 * 3. Processes Slack events (messages, reactions, etc.)
 * 4. Provides endpoints for health checks and manual testing
 * 5. Starts the daily summary scheduler
 * 
 * When you run "npm start", this file is executed.
 */

// Import Express framework (for creating web server)
const express = require('express');
// Import body-parser (for parsing JSON request bodies)
const bodyParser = require('body-parser');
// Import crypto (Node.js built-in, for verifying Slack signatures)
const crypto = require('crypto');

// Import our custom modules
const config = require('./config');                    // Configuration settings
const { initDb } = require('./db');                    // Database initialization
const { processSlackEvent } = require('./eventsHandler');  // Event processing
const { scheduleDailySummary, runDailySummaryJob } = require('./scheduler');  // Scheduler
const { handleSentimentShortcut } = require('./sentimentService');           // Modal-based sentiment analysis

// Create an Express application instance
// This is our web server
const app = express();

/**
 * Middleware function to save the raw request body
 * 
 * Why we need this:
 * - Slack sends requests with a signature in the headers
 * - To verify the signature, we need the original raw body (before JSON parsing)
 * - bodyParser.json() parses JSON but modifies the body
 * - This function saves the raw body before parsing
 * 
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {Buffer} buf - Raw request body as a buffer
 */
const rawBodySaver = (req, res, buf) => {
  if (buf?.length) {  // If buffer exists and has content
    req.rawBody = buf.toString('utf8');  // Convert to string and save to req.rawBody
  }
};

// Use body-parser middleware to parse JSON request bodies
// verify: rawBodySaver means "call rawBodySaver before parsing"
app.use(
  bodyParser.json({
    verify: rawBodySaver,  // Save raw body before parsing
  })
);

/**
 * Middleware function to verify Slack request signatures
 * 
 * Why we need this:
 * - Security: Make sure requests are really from Slack, not hackers
 * - Slack signs every request with a secret key
 * - We verify the signature matches what we expect
 * 
 * How it works:
 * 1. Get signature and timestamp from request headers
 * 2. Check if request is too old (replay attack protection)
 * 3. Calculate what the signature should be
 * 4. Compare with the signature Slack sent
 * 5. If they match, request is valid. If not, reject it.
 * 
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Call next middleware/route handler
 */
function verifySlackSignature(req, res, next) {
  // If signing secret is not configured, skip verification (for development)
  if (!config.slackSigningSecret) {
    return next();  // Continue to next handler
  }

  // Get signature and timestamp from request headers
  // Slack sends these in every request
  const signature = req.headers['x-slack-signature'];  // The signature
  const timestamp = req.headers['x-slack-request-timestamp'];  // When request was sent

  // Check if headers are present
  if (!signature || !timestamp) {
    return res.status(400).send('Missing Slack signature headers.');
  }

  // Convert timestamp to number and check if request is too old
  // Reject requests older than 5 minutes (prevents replay attacks)
  const ts = Number(timestamp);
  if (Number.isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 60 * 5) {
    return res.status(400).send('Stale Slack request.');
  }

  // Calculate what the signature should be
  // Slack uses HMAC-SHA256 algorithm
  const hmac = crypto.createHmac('sha256', config.slackSigningSecret);
  const base = `v0:${timestamp}:${req.rawBody || ''}`;  // Format: "v0:timestamp:body"
  hmac.update(base);  // Calculate hash
  const computed = `v0=${hmac.digest('hex')}`;  // Format: "v0=hash"

  // Compare computed signature with Slack's signature
  // Use timingSafeEqual to prevent timing attacks (security)
  if (!crypto.timingSafeEqual(Buffer.from(computed, 'utf8'), Buffer.from(signature, 'utf8'))) {
    return res.status(400).send('Invalid Slack signature.');
  }

  // Signature is valid, continue to next handler
  return next();
}

/**
 * Health check endpoint
 * 
 * GET /health
 * 
 * Used to check if the server is running
 * Render and other services can ping this to verify the app is alive
 */
app.get('/health', (req, res) => {
  // Return JSON response
  res.json({ status: 'ok', message: 'Slack stats service running.' });
});

/**
 * Slack Events API endpoint
 * 
 * POST /api/slack/events
 * 
 * This is where Slack sends all events (messages, reactions, etc.)
 * 
 * Flow:
 * 1. Slack sends event to this endpoint
 * 2. We verify it's really from Slack (signature check)
 * 3. Handle URL verification (when Slack first connects)
 * 4. Process the event (save to database)
 * 5. Send 200 OK response to Slack
 */
app.post('/api/slack/events', async (req, res) => {
  // Get the request body (JSON payload from Slack)
  const payload = req.body;

  // Debug: Log all incoming requests (helps with troubleshooting)
  console.log(`\n🔔 Incoming Slack request:`, {
    type: payload.type,              // Type of request
    eventType: payload.event?.type,  // Type of event (if it's an event)
    hasEvent: !!payload.event,       // Does it have an event?
    timestamp: new Date().toISOString(),  // When we received it
  });

  // Handle URL verification
  // When you first set up the Slack app, Slack sends a "url_verification" request
  // We need to echo back the "challenge" value to prove we control the URL
  if (payload.type === 'url_verification') {
    console.log(`✅ URL verification challenge received: ${payload.challenge}`);
    // Send back the challenge value (this verifies the URL)
    return res.status(200).send(payload.challenge);
  }

  // Verify signature for event callbacks
  // For actual events (not URL verification), we need to verify the signature
  if (payload.type === 'event_callback') {
    // Get signature and timestamp from headers
    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];

    // Check if headers are present
    if (!signature || !timestamp) {
      console.error('❌ Missing Slack signature headers');
      return res.status(400).send('Missing Slack signature headers.');
    }

    // Verify signature if signing secret is configured
    if (config.slackSigningSecret) {
      // Check if request is too old (replay attack protection)
      const ts = Number(timestamp);
      if (Number.isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 60 * 5) {
        console.error('❌ Stale Slack request');
        return res.status(400).send('Stale Slack request.');
      }

      // Calculate expected signature
      const hmac = crypto.createHmac('sha256', config.slackSigningSecret);
      const base = `v0:${timestamp}:${req.rawBody || ''}`;
      hmac.update(base);
      const computed = `v0=${hmac.digest('hex')}`;

      // Compare signatures
      if (!crypto.timingSafeEqual(Buffer.from(computed, 'utf8'), Buffer.from(signature, 'utf8'))) {
        console.error('❌ Invalid Slack signature');
        return res.status(400).send('Invalid Slack signature.');
      }
    }
  }

  // Handle event callbacks (actual events from Slack)
  if (payload.type === 'event_callback') {
    console.log(`📨 Event callback received for: ${payload.event?.type || 'unknown'}`);
    try {
      // Process the event (save to database, etc.)
      await processSlackEvent(payload);
    } catch (error) {
      // If something goes wrong, log it but don't crash
      console.error('❌ Error processing Slack event:', error);
    }
  } else if (payload.type !== 'url_verification') {
    // If it's not a known type, log it
    console.log(`⚠️  Unknown payload type: ${payload.type}`);
  }

  // Always send 200 OK to Slack (even if we had errors)
  // This tells Slack we received the event
  // If we don't respond, Slack will retry the event
  return res.status(200).send();
});

/**
 * Manual summary trigger endpoint
 * 
 * POST /api/slack/run-summary
 * 
 * This endpoint allows you to manually trigger the daily summary
 * Useful for testing or if you want to run it outside the scheduled time
 * 
 * Request body (optional):
 * {
 *   "date": "2024-01-15"  // Optional: specific date. If not provided, uses yesterday
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "date": "yesterday" or the date you provided
 * }
 */
app.post('/api/slack/run-summary', async (req, res) => {
  // Get optional date from request body
  const { date } = req.body || {};
  
  try {
    // Run the summary job
    // defaultToToday: false means use yesterday (not today)
    await runDailySummaryJob({ date, defaultToToday: false });
    
    // Return success response
    res.json({ success: true, date: date || 'yesterday' });
  } catch (error) {
    // If something goes wrong, return error response
    console.error('Failed to run summary job manually:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post(
  '/api/slack/command',
  bodyParser.urlencoded({ extended: true }),
  async (req, res) => {
    const { command, channel_id: channelId, user_id: userId } = req.body || {};

    if (command !== '/dailyengage') {
      return res.json({
        response_type: 'ephemeral',
        text: 'Only /dailyengage is supported.',
      });
    }

    res.json({
      response_type: 'ephemeral',
      text: `✅ Collecting yesterday's stats for <#${channelId}>...`,
    });

    try {
      await runDailySummaryJob({ defaultToToday: false, channelId });
      console.log(`Slash command triggered by ${userId} in ${channelId}.`);
    } catch (error) {
      console.error('Failed to run summary via slash command:', error);
    }
  }
);

/**
 * Slack message shortcut endpoint for "Sentiment Score"
 *
 * Slack sends a URL-encoded payload that contains message + channel info.
 * Flow:
 * 1. Parse payload and acknowledge Slack (200 OK) immediately.
 * 2. Trigger handleSentimentShortcut, which opens a modal and updates it with results.
 */
app.post(
  '/api/slack/sentiment',
  bodyParser.urlencoded({ extended: true }),
  async (req, res) => {
    const { payload } = req.body || {};

    if (!payload) {
      return res.status(400).send('Missing Slack payload.');
    }

    let actionPayload;
    try {
      actionPayload = JSON.parse(payload);
    } catch (error) {
      console.error('❌ Invalid Slack shortcut payload:', error);
      return res.status(400).send('Invalid Slack payload.');
    }

    // Acknowledge Slack right away to avoid timeouts
    res.status(200).send();

    try {
      await handleSentimentShortcut(actionPayload);
    } catch (error) {
      console.error('❌ Failed to process sentiment shortcut:', error);
    }
  }
);

/**
 * Start the server
 * 
 * This function:
 * 1. Initializes the database (creates tables if needed)
 * 2. Sets up the daily summary scheduler
 * 3. Starts the web server listening on the configured port
 */
async function start() {
  // Step 1: Initialize database
  // This creates all the tables we need (reaction_events, message_events, etc.)
  await initDb();
  
  // Step 2: Schedule the daily summary
  // This sets up a cron job to run at the configured time (e.g., 10 AM)
  scheduleDailySummary();

  // Step 3: Start the web server
  // Listen on the configured port (3000 for local, Render sets its own)
  app.listen(config.port, () => {
    console.log(`🚀 Server listening on http://localhost:${config.port}`);
  });
}

// Start the server
// If there's an error, log it and exit
start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);  // Exit with error code 1
});
