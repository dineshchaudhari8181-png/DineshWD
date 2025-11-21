/**
 * CONFIG.JS - Configuration File
 * 
 * This file loads all environment variables from .env file and creates a config object
 * that other files can use. Environment variables are settings that change between
 * different environments (local development vs production on Render).
 */

// Import Node.js built-in modules
const path = require('path');        // Helps work with file/folder paths
const dotenv = require('dotenv');    // Library to load .env file

/**
 * Load environment variables from .env file
 * - If DOTENV_PATH is set, use that path
 * - Otherwise, look for .env file in the current project folder
 */
dotenv.config({
  path: process.env.DOTENV_PATH || path.resolve(process.cwd(), '.env'),
});

/**
 * Helper function to convert a string to a number
 * @param {string} value - The string to convert
 * @param {number} fallback - If conversion fails, return this number instead
 * @returns {number} - The converted number or fallback
 * 
 * Example: toNumber("3000", 5000) returns 3000
 *          toNumber("abc", 5000) returns 5000 (because "abc" can't be converted)
 */
const toNumber = (value, fallback) => {
  const parsed = parseInt(value, 10);  // Try to convert string to integer (base 10)
  return Number.isNaN(parsed) ? fallback : parsed;  // If failed, return fallback
};

/**
 * Main configuration object
 * This object stores all settings needed by the application
 * Values come from environment variables (in .env file) or use default values
 */
const config = {
  // Server port - where the web server listens (3000 for local, Render sets its own)
  port: toNumber(process.env.PORT, 3000),
  
  // Slack Bot Token - allows the bot to send messages and read data from Slack
  // Format: xoxb-xxxxx-xxxxx-xxxxx
  slackBotToken: process.env.SLACK_BOT_TOKEN || '',
  
  // Slack Signing Secret - used to verify that requests are really from Slack (security)
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET || '',
  
  // Channel ID where the daily summary will be posted
  // Format: C09SUH2KHK2 (starts with C for public channels)
  slackChannelId: process.env.SLACK_CHANNEL_ID || '',
  
  // Cron schedule - when to run the daily summary
  // Format: "minute hour day month weekday"
  // "0 15 * * *" means: at 3:00 PM every day
  cronSchedule: process.env.CRON_SCHEDULE || '0 15 * * *',
  
  // Timezone for the cron schedule (e.g., "Asia/Kolkata" for India time)
  timezone: process.env.CRON_TIMEZONE || 'Asia/Kolkata',
  
  // Database URL - full connection string (used by Render)
  // Format: postgresql://user:password@host:port/database
  databaseUrl: process.env.DATABASE_URL || '',
  
  // Database connection details (used when DATABASE_URL is not available)
  db: {
    host: process.env.DB_HOST || 'localhost',           // Database server address
    port: toNumber(process.env.DB_PORT, 5432),          // Database port (5432 is PostgreSQL default)
    database: process.env.DB_NAME || 'slack_dev_db',    // Database name
    user: process.env.DB_USER || 'slack_user',          // Database username
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',  // Database password
    ssl: process.env.DB_SSL === 'true',                 // Use SSL encryption (needed for Render)
  },
  
  // Gemini AI Configuration (for advanced sentiment analysis fallback)
  geminiApiKey: process.env.GEMINI_API_KEY || '',       // Google Gemini API key
  geminiModel: process.env.GEMINI_MODEL || 'gemini-pro', // Gemini model name
};

// Export the config object so other files can import and use it
module.exports = config;

