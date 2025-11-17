const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: process.env.DOTENV_PATH || path.resolve(process.cwd(), '.env'),
});

const toNumber = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const config = {
  port: toNumber(process.env.PORT, 3000),
  slackBotToken: process.env.SLACK_BOT_TOKEN || '',
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET || '',
  slackChannelId: process.env.SLACK_CHANNEL_ID || '',
  cronSchedule: process.env.CRON_SCHEDULE || '0 10 * * *',
  timezone: process.env.CRON_TIMEZONE || 'UTC',
  databaseUrl: process.env.DATABASE_URL || '',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: toNumber(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME || 'slack_dev_db',
    user: process.env.DB_USER || 'slack_user',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    ssl: process.env.DB_SSL === 'true',
  },
};

module.exports = config;

