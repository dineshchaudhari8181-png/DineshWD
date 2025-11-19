require('dotenv').config();
const { pool } = require('./src/db');
const config = require('./src/config');

// Show which database we're connecting to
console.log('🔍 Database Connection Info:');
console.log('  DB Host:', config.db.host || 'Using DATABASE_URL');
console.log('  DB Name:', config.db.database);
console.log('  Channel ID:', config.slackChannelId || 'C09SUH2KHK2');
console.log('');

(async () => {
  const timezone = 'Asia/Kolkata';
  const channelId = process.env.SLACK_CHANNEL_ID || 'C09SUH2KHK2';
  
  // Get today's date range in IST (using same method as statsService)
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const [year, month, day] = formatter.format(now).split('-').map(Number);
  
  // Create start time: 1:00 AM IST today (using same method as statsService.getDayRange)
  const todayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  // Adjust for IST: 1:00 AM IST = previous day 7:30 PM UTC (UTC+5:30)
  // So 1:00 AM IST on Nov 19 = Nov 18 19:30 UTC
  todayStart.setUTCHours(19, 30, 0, 0); // 1:00 AM IST = 19:30 UTC previous day
  todayStart.setUTCDate(todayStart.getUTCDate() - 1); // Go back one day
  
  // For end time, use current time (which is already in UTC)
  const todayEnd = new Date();
  
  console.log('📅 Query Range (IST):');
  console.log('Date: 19/11/2025');
  console.log('Time Range: 1:00 AM to Current Time');
  console.log('Start (UTC):', todayStart.toISOString());
  console.log('End (UTC):', todayEnd.toISOString());
  console.log('Current time (IST):', now.toLocaleString('en-US', { timeZone: timezone }));
  console.log('\n📊 TODAY\'S ACTIVITY SUMMARY:\n');
  
  // Also check what events exist in database (for debugging)
  const allEventsCheck = await pool.query(
    'SELECT COUNT(*) as total FROM message_events WHERE channel_id = $1',
    [channelId]
  );
  console.log('🔍 Debug: Total messages in DB for this channel:', allEventsCheck.rows[0].total);
  
  // Check recent events regardless of date (by created_at to see if events are being stored)
  const recentEvents = await pool.query(
    'SELECT message_ts, created_at FROM message_events WHERE channel_id = $1 ORDER BY created_at DESC LIMIT 10',
    [channelId]
  );
  if (recentEvents.rows.length > 0) {
    console.log('\n🔍 Recent messages in DB (by created_at):');
    recentEvents.rows.forEach((e, i) => {
      const msgTime = new Date(e.message_ts).toLocaleString('en-US', { timeZone: timezone });
      const createdTime = new Date(e.created_at).toLocaleString('en-US', { timeZone: timezone });
      console.log(`  ${i+1}. Event Time: ${msgTime} | Stored At: ${createdTime}`);
    });
  }
  
  // Check if there are any events created TODAY (regardless of event_ts)
  const todayCreated = await pool.query(
    'SELECT COUNT(*) as count FROM message_events WHERE channel_id = $1 AND created_at >= $2 AND created_at <= $3',
    [channelId, todayStart, todayEnd]
  );
  console.log('🔍 Events stored TODAY (by created_at):', todayCreated.rows[0].count);
  
  // Check ALL channels for today's events (in case channel ID is wrong)
  const allChannelsToday = await pool.query(
    'SELECT channel_id, COUNT(*) as count FROM message_events WHERE created_at >= $1 AND created_at <= $2 GROUP BY channel_id',
    [todayStart, todayEnd]
  );
  if (allChannelsToday.rows.length > 0) {
    console.log('\n🔍 Events in ALL channels today:');
    allChannelsToday.rows.forEach((row) => {
      console.log(`  Channel ${row.channel_id}: ${row.count} messages`);
    });
  }
  
  // Check ALL file events from today in any channel
  const allFilesToday = await pool.query(
    'SELECT channel_id, file_name, event_ts, created_at FROM file_events WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC',
    [todayStart, todayEnd]
  );
  if (allFilesToday.rows.length > 0) {
    console.log('\n🔍 File events stored TODAY (any channel):');
    allFilesToday.rows.forEach((f, i) => {
      const fileTime = new Date(f.event_ts).toLocaleString('en-US', { timeZone: timezone });
      const createdTime = new Date(f.created_at).toLocaleString('en-US', { timeZone: timezone });
      console.log(`  ${i+1}. Channel: ${f.channel_id}, File: ${f.file_name || 'Unknown'}, Event Time: ${fileTime}, Stored At: ${createdTime}`);
    });
  }
  
  // Check all file events
  const allFiles = await pool.query(
    'SELECT id, user_id, file_name, event_ts, created_at FROM file_events WHERE channel_id = $1 ORDER BY created_at DESC LIMIT 10',
    [channelId]
  );
  if (allFiles.rows.length > 0) {
    console.log('\n🔍 All file events in DB:');
    allFiles.rows.forEach((f, i) => {
      const fileTime = new Date(f.event_ts).toLocaleString('en-US', { timeZone: timezone });
      const createdTime = new Date(f.created_at).toLocaleString('en-US', { timeZone: timezone });
      console.log(`  ${i+1}. File: ${f.file_name || 'Unknown'}, Event Time: ${fileTime}, Stored At: ${createdTime}`);
    });
  }
  
  console.log('\n');
  
  // First, check if the specific message that was saved is in DB
  const savedMessageCheck = await pool.query(
    'SELECT * FROM message_events WHERE event_id = $1',
    ['Ev09TEND4HN3']
  );
  if (savedMessageCheck.rows.length > 0) {
    console.log('\n✅ Found saved message Ev09TEND4HN3:');
    const m = savedMessageCheck.rows[0];
    console.log(`   Event Time (message_ts): ${new Date(m.message_ts).toISOString()}`);
    console.log(`   Created At: ${new Date(m.created_at).toISOString()}`);
    console.log(`   Channel: ${m.channel_id}`);
  } else {
    console.log('\n❌ Message Ev09TEND4HN3 NOT found in database!');
  }
  
  // Query all event types for today
  const [messages, reactions, files, membersJoined, membersLeft] = await Promise.all([
    pool.query(
      'SELECT COUNT(*) as count FROM message_events WHERE channel_id = $1 AND message_ts >= $2 AND message_ts <= $3',
      [channelId, todayStart, todayEnd]
    ),
    pool.query(
      'SELECT COUNT(*) as count FROM reaction_events WHERE channel_id = $1 AND event_ts >= $2 AND event_ts <= $3',
      [channelId, todayStart, todayEnd]
    ),
    pool.query(
      'SELECT COUNT(*) as count FROM file_events WHERE channel_id = $1 AND event_ts >= $2 AND event_ts <= $3',
      [channelId, todayStart, todayEnd]
    ),
    pool.query(
      'SELECT COUNT(*) as count FROM member_events WHERE channel_id = $1 AND event_type = $2 AND event_ts >= $3 AND event_ts <= $4',
      [channelId, 'member_joined_channel', todayStart, todayEnd]
    ),
    pool.query(
      'SELECT COUNT(*) as count FROM member_events WHERE channel_id = $1 AND event_type = $2 AND event_ts >= $3 AND event_ts <= $4',
      [channelId, 'member_left_channel', todayStart, todayEnd]
    )
  ]);
  
  console.log('💬 Messages Sent:', messages.rows[0].count);
  console.log('👍 Reactions Added:', reactions.rows[0].count);
  console.log('📎 File Uploads:', files.rows[0].count);
  console.log('👥 New Members:', membersJoined.rows[0].count);
  console.log('👋 Members Removed:', membersLeft.rows[0].count);
  
  console.log('\n📋 DETAILED BREAKDOWN:\n');
  
  // Get detailed message list
  const msgDetails = await pool.query(
    'SELECT id, user_id, message_ts, created_at FROM message_events WHERE channel_id = $1 AND message_ts >= $2 AND message_ts <= $3 ORDER BY message_ts DESC',
    [channelId, todayStart, todayEnd]
  );
  console.log('Messages (' + msgDetails.rows.length + '):');
  msgDetails.rows.forEach((m, i) => {
    const time = new Date(m.message_ts).toLocaleString('en-US', { timeZone: timezone });
    console.log(`  ${i+1}. User: ${m.user_id}, Time: ${time}`);
  });
  
  // Get detailed reactions list
  const reactDetails = await pool.query(
    'SELECT id, user_id, reaction, event_ts FROM reaction_events WHERE channel_id = $1 AND event_ts >= $2 AND event_ts <= $3 ORDER BY event_ts DESC LIMIT 10',
    [channelId, todayStart, todayEnd]
  );
  console.log('\nReactions (' + reactDetails.rows.length + '):');
  reactDetails.rows.forEach((r, i) => {
    const time = new Date(r.event_ts).toLocaleString('en-US', { timeZone: timezone });
    console.log(`  ${i+1}. User: ${r.user_id}, Reaction: ${r.reaction}, Time: ${time}`);
  });
  
  // Get detailed files list
  const fileDetails = await pool.query(
    'SELECT id, user_id, file_name, event_ts FROM file_events WHERE channel_id = $1 AND event_ts >= $2 AND event_ts <= $3 ORDER BY event_ts DESC',
    [channelId, todayStart, todayEnd]
  );
  console.log('\nFiles (' + fileDetails.rows.length + '):');
  fileDetails.rows.forEach((f, i) => {
    const time = new Date(f.event_ts).toLocaleString('en-US', { timeZone: timezone });
    console.log(`  ${i+1}. User: ${f.user_id}, File: ${f.file_name || 'Unknown'}, Time: ${time}`);
  });
  
  // Get member events
  const memberDetails = await pool.query(
    'SELECT id, user_id, event_type, event_ts FROM member_events WHERE channel_id = $1 AND event_ts >= $2 AND event_ts <= $3 ORDER BY event_ts DESC',
    [channelId, todayStart, todayEnd]
  );
  console.log('\nMember Events (' + memberDetails.rows.length + '):');
  memberDetails.rows.forEach((m, i) => {
    const time = new Date(m.event_ts).toLocaleString('en-US', { timeZone: timezone });
    const type = m.event_type === 'member_joined_channel' ? 'Joined' : 'Left';
    console.log(`  ${i+1}. User: ${m.user_id}, Action: ${type}, Time: ${time}`);
  });
  
  await pool.end();
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

