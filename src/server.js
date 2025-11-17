const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const config = require('./config');
const { initDb } = require('./db');
const { processSlackEvent } = require('./eventsHandler');
const { scheduleDailySummary, runDailySummaryJob } = require('./scheduler');

const app = express();

const rawBodySaver = (req, res, buf) => {
  if (buf?.length) {
    req.rawBody = buf.toString('utf8');
  }
};

app.use(
  bodyParser.json({
    verify: rawBodySaver,
  })
);

function verifySlackSignature(req, res, next) {
  if (!config.slackSigningSecret) {
    return next();
  }

  const signature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-request-timestamp'];

  if (!signature || !timestamp) {
    return res.status(400).send('Missing Slack signature headers.');
  }

  const ts = Number(timestamp);
  if (Number.isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 60 * 5) {
    return res.status(400).send('Stale Slack request.');
  }

  const hmac = crypto.createHmac('sha256', config.slackSigningSecret);
  const base = `v0:${timestamp}:${req.rawBody || ''}`;
  hmac.update(base);
  const computed = `v0=${hmac.digest('hex')}`;

  if (!crypto.timingSafeEqual(Buffer.from(computed, 'utf8'), Buffer.from(signature, 'utf8'))) {
    return res.status(400).send('Invalid Slack signature.');
  }

  return next();
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Slack stats service running.' });
});

app.post('/api/slack/events', async (req, res) => {
  const payload = req.body;

  // Debug: Log all incoming requests
  console.log(`\n🔔 Incoming Slack request:`, {
    type: payload.type,
    eventType: payload.event?.type,
    hasEvent: !!payload.event,
    timestamp: new Date().toISOString(),
  });

  // Handle URL verification (no signature needed)
  if (payload.type === 'url_verification') {
    console.log(`✅ URL verification challenge received: ${payload.challenge}`);
    return res.status(200).send(payload.challenge);
  }

  // Verify signature for event callbacks
  if (payload.type === 'event_callback') {
    // Verify signature
    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];

    if (!signature || !timestamp) {
      console.error('❌ Missing Slack signature headers');
      return res.status(400).send('Missing Slack signature headers.');
    }

    if (config.slackSigningSecret) {
      const ts = Number(timestamp);
      if (Number.isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 60 * 5) {
        console.error('❌ Stale Slack request');
        return res.status(400).send('Stale Slack request.');
      }

      const hmac = crypto.createHmac('sha256', config.slackSigningSecret);
      const base = `v0:${timestamp}:${req.rawBody || ''}`;
      hmac.update(base);
      const computed = `v0=${hmac.digest('hex')}`;

      if (!crypto.timingSafeEqual(Buffer.from(computed, 'utf8'), Buffer.from(signature, 'utf8'))) {
        console.error('❌ Invalid Slack signature');
        return res.status(400).send('Invalid Slack signature.');
      }
    }
  }

  // Handle event callbacks
  if (payload.type === 'event_callback') {
    console.log(`📨 Event callback received for: ${payload.event?.type || 'unknown'}`);
    try {
      await processSlackEvent(payload);
    } catch (error) {
      console.error('❌ Error processing Slack event:', error);
    }
  } else if (payload.type !== 'url_verification') {
    console.log(`⚠️  Unknown payload type: ${payload.type}`);
  }

  return res.status(200).send();
});

app.post('/api/slack/run-summary', async (req, res) => {
  const { date } = req.body || {};
  try {
    await runDailySummaryJob({ date, defaultToToday: false });
    res.json({ success: true, date: date || 'yesterday' });
  } catch (error) {
    console.error('Failed to run summary job manually:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function start() {
  await initDb();
  scheduleDailySummary();

  app.listen(config.port, () => {
    console.log(`🚀 Server listening on http://localhost:${config.port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

