/**
 * DB.JS - Database Connection and Setup
 * 
 * This file handles:
 * 1. Connecting to PostgreSQL database
 * 2. Creating all necessary tables if they don't exist
 * 
 * PostgreSQL is a database system that stores all our Slack event data.
 */

// Import the pg library (PostgreSQL client for Node.js)
const { Pool } = require('pg');
// Import our config to get database connection details
const config = require('./config');

/**
 * Function to get database connection configuration
 * Returns different settings based on whether we're using DATABASE_URL (Render) 
 * or individual connection details (local development)
 * 
 * @returns {object} - Database connection configuration object
 */
const getPoolConfig = () => {
  // If DATABASE_URL is provided (like on Render), use it
  // DATABASE_URL contains everything: user, password, host, port, database name
  if (config.databaseUrl) {
    return {
      connectionString: config.databaseUrl,  // Full connection string
      // Render databases require SSL encryption for security
      // rejectUnauthorized: false means "don't verify SSL certificate" (okay for Render)
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    };
  }

  // Otherwise, use individual connection details (for local development)
  return {
    host: config.db.host,           // Database server address (localhost for local)
    port: config.db.port,           // Port number (5432 is PostgreSQL default)
    database: config.db.database,   // Database name (slack_dev_db)
    user: config.db.user,           // Username (slack_user)
    password: config.db.password,   // Password
    // Enable SSL if in production or if explicitly set to 'true'
    ssl: process.env.NODE_ENV === 'production' || config.db.ssl === 'true' 
      ? { rejectUnauthorized: false } 
      : undefined,
  };
};

/**
 * Create a connection pool
 * A pool manages multiple database connections efficiently
 * Instead of creating a new connection for each query, it reuses existing ones
 */
const pool = new Pool(getPoolConfig());

/**
 * Initialize the database
 * This function creates all the tables we need if they don't already exist
 * 
 * Tables created:
 * 1. reaction_events - Stores when someone adds a reaction (emoji) to a message
 * 2. member_events - Stores when someone joins or leaves the channel
 * 3. message_events - Stores when someone sends a message
 * 4. file_events - Stores when someone uploads a file
 * 5. daily_summaries - Stores the daily summary results that were posted to Slack
 * 
 * This function runs automatically when the server starts
 */
async function initDb() {
  // Array of SQL CREATE TABLE statements
  // Each statement creates a table with specific columns
  const queries = [
    /**
     * REACTION_EVENTS TABLE
     * Stores every time someone adds a reaction (emoji) to a message
     */
    `CREATE TABLE IF NOT EXISTS reaction_events (
        id SERIAL PRIMARY KEY,              -- Auto-incrementing unique ID (1, 2, 3, ...)
        event_id TEXT UNIQUE NOT NULL,      -- Slack's unique event ID (prevents duplicates)
        channel_id TEXT NOT NULL,           -- Which channel the reaction was in
        user_id TEXT NOT NULL,              -- Who added the reaction
        reaction TEXT NOT NULL,             -- Which emoji was used (e.g., "thumbsup")
        event_ts TIMESTAMPTZ NOT NULL,      -- When the reaction was added (timestamp)
        raw_event JSONB,                    -- Full event data from Slack (for debugging)
        created_at TIMESTAMPTZ DEFAULT NOW() -- When we saved this record
     );`,
    
    /**
     * MEMBER_EVENTS TABLE
     * Stores when members join or leave the channel
     */
    `CREATE TABLE IF NOT EXISTS member_events (
        id SERIAL PRIMARY KEY,              -- Auto-incrementing unique ID
        event_id TEXT UNIQUE NOT NULL,      -- Slack's unique event ID
        channel_id TEXT NOT NULL,           -- Which channel
        user_id TEXT NOT NULL,              -- Who joined/left
        event_type TEXT NOT NULL,           -- "member_joined_channel" or "member_left_channel"
        event_ts TIMESTAMPTZ NOT NULL,      -- When it happened
        raw_event JSONB,                    -- Full event data
        created_at TIMESTAMPTZ DEFAULT NOW() -- When we saved this
     );`,
    
    /**
     * MESSAGE_EVENTS TABLE
     * Stores every message sent in the channel
     */
    `CREATE TABLE IF NOT EXISTS message_events (
        id SERIAL PRIMARY KEY,              -- Auto-incrementing unique ID
        event_id TEXT UNIQUE NOT NULL,      -- Slack's unique event ID
        channel_id TEXT NOT NULL,           -- Which channel
        user_id TEXT NOT NULL,              -- Who sent the message
        message_ts TIMESTAMPTZ NOT NULL,    -- When the message was sent
        raw_event JSONB,                    -- Full message data
        created_at TIMESTAMPTZ DEFAULT NOW() -- When we saved this
     );`,
    
    /**
     * FILE_EVENTS TABLE
     * Stores every file uploaded to the channel
     */
    `CREATE TABLE IF NOT EXISTS file_events (
        id SERIAL PRIMARY KEY,              -- Auto-incrementing unique ID
        event_id TEXT UNIQUE NOT NULL,      -- Slack's unique event ID
        channel_id TEXT NOT NULL,           -- Which channel
        user_id TEXT NOT NULL,              -- Who uploaded the file
        file_id TEXT,                       -- Slack's file ID
        file_name TEXT,                     -- Name of the file
        event_ts TIMESTAMPTZ NOT NULL,      -- When it was uploaded
        raw_event JSONB,                    -- Full event data
        created_at TIMESTAMPTZ DEFAULT NOW() -- When we saved this
     );`,
    
    /**
     * DAILY_SUMMARIES TABLE
     * Stores the summary results that were posted to Slack each day
     * This is like a history/log of all summaries we've sent
     */
    `CREATE TABLE IF NOT EXISTS daily_summaries (
        id SERIAL PRIMARY KEY,              -- Auto-incrementing unique ID
        channel_id TEXT NOT NULL,           -- Which channel
        stat_date DATE NOT NULL,            -- Which date the summary is for (YYYY-MM-DD)
        reaction_count INTEGER NOT NULL DEFAULT 0,      -- Total reactions that day
        new_member_count INTEGER NOT NULL DEFAULT 0,    -- New members that day
        member_removed_count INTEGER NOT NULL DEFAULT 0, -- Members who left that day
        message_count INTEGER NOT NULL DEFAULT 0,       -- Total messages that day
        file_upload_count INTEGER NOT NULL DEFAULT 0,   -- Total files uploaded that day
        message_ts TEXT,                    -- Slack message timestamp (if we posted it)
        created_at TIMESTAMPTZ DEFAULT NOW(), -- When we saved this summary
        UNIQUE(channel_id, stat_date)       -- Can't have two summaries for same channel+date
     );`,
  ];

  // Execute each CREATE TABLE query one by one
  // "IF NOT EXISTS" means it won't error if the table already exists
  for (const query of queries) {
    await pool.query(query);  // Run the SQL query
  }
}

// Export the pool (for other files to use) and initDb function
module.exports = {
  pool,      // Database connection pool
  initDb,    // Function to initialize/create tables
};

