const { Pool } = require('pg');
const config = require('./config');

const getPoolConfig = () => {
  // Render provides DATABASE_URL, use it if available
  if (config.databaseUrl) {
    return {
      connectionString: config.databaseUrl,
      // Render databases require SSL
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    };
  }

  return {
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    // Enable SSL for production (Render) or if explicitly set
    ssl: process.env.NODE_ENV === 'production' || config.db.ssl === 'true' 
      ? { rejectUnauthorized: false } 
      : undefined,
  };
};

const pool = new Pool(getPoolConfig());

async function initDb() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS reaction_events (
        id SERIAL PRIMARY KEY,
        event_id TEXT UNIQUE NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        reaction TEXT NOT NULL,
        event_ts TIMESTAMPTZ NOT NULL,
        raw_event JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
     );`,
    `CREATE TABLE IF NOT EXISTS member_events (
        id SERIAL PRIMARY KEY,
        event_id TEXT UNIQUE NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_ts TIMESTAMPTZ NOT NULL,
        raw_event JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
     );`,
    `CREATE TABLE IF NOT EXISTS message_events (
        id SERIAL PRIMARY KEY,
        event_id TEXT UNIQUE NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        message_ts TIMESTAMPTZ NOT NULL,
        raw_event JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
     );`,
    `CREATE TABLE IF NOT EXISTS file_events (
        id SERIAL PRIMARY KEY,
        event_id TEXT UNIQUE NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        file_id TEXT,
        file_name TEXT,
        event_ts TIMESTAMPTZ NOT NULL,
        raw_event JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
     );`,
    `CREATE TABLE IF NOT EXISTS daily_summaries (
        id SERIAL PRIMARY KEY,
        channel_id TEXT NOT NULL,
        stat_date DATE NOT NULL,
        reaction_count INTEGER NOT NULL DEFAULT 0,
        new_member_count INTEGER NOT NULL DEFAULT 0,
        member_removed_count INTEGER NOT NULL DEFAULT 0,
        message_count INTEGER NOT NULL DEFAULT 0,
        file_upload_count INTEGER NOT NULL DEFAULT 0,
        message_ts TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(channel_id, stat_date)
     );`,
  ];

  for (const query of queries) {
    await pool.query(query);
  }
}

module.exports = {
  pool,
  initDb,
};

