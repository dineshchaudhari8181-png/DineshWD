const config = require('./config');
const { saveReactionEvent, saveMemberEvent, saveMessageEvent, saveFileEvent } = require('./eventsStore');

function slackTsToDate(eventTs) {
  if (!eventTs) return new Date();
  const millis = Number(eventTs) * 1000;
  return new Date(millis);
}

async function handleReactionAdded({ eventId, event }) {
  const channelId = event.item?.channel;
  if (!channelId || (config.slackChannelId && channelId !== config.slackChannelId)) {
    return;
  }

  await saveReactionEvent({
    eventId,
    channelId,
    userId: event.user,
    reaction: event.reaction,
    eventTs: slackTsToDate(event.event_ts),
    rawEvent: event,
  });
}

async function handleMemberJoined({ eventId, event }) {
  const channelId = event.channel;
  if (!channelId || (config.slackChannelId && channelId !== config.slackChannelId)) {
    return;
  }

  await saveMemberEvent({
    eventId,
    channelId,
    userId: event.user,
    eventType: event.type,
    eventTs: slackTsToDate(event.event_ts || event.ts),
    rawEvent: event,
  });
}

async function handleMemberLeft({ eventId, event }) {
  const channelId = event.channel;
  if (!channelId || (config.slackChannelId && channelId !== config.slackChannelId)) {
    return;
  }

  await saveMemberEvent({
    eventId,
    channelId,
    userId: event.user,
    eventType: event.type,
    eventTs: slackTsToDate(event.event_ts || event.ts),
    rawEvent: event,
  });
}

async function handleMessage({ eventId, event }) {
  const channelId = event.channel;
  
  // Debug logging
  console.log(`🔍 Message event details:`, {
    channelId,
    targetChannel: config.slackChannelId,
    hasSubtype: !!event.subtype,
    hasBotId: !!event.bot_id,
    userId: event.user,
  });

  if (!channelId || (config.slackChannelId && channelId !== config.slackChannelId)) {
    console.log(`❌ Message skipped: Channel mismatch or missing channel ID`);
    return;
  }

  // Skip bot messages and message subtypes (edits, deletions, etc.)
  if (event.subtype || event.bot_id) {
    console.log(`⏭️  Message skipped: Bot message or subtype (${event.subtype || 'bot_id'})`);
    return;
  }

  try {
    await saveMessageEvent({
      eventId,
      channelId,
      userId: event.user,
      eventTs: slackTsToDate(event.event_ts || event.ts),
      rawEvent: event,
    });
    console.log(`✅ Message event saved: ${eventId}`);
  } catch (error) {
    console.error(`❌ Error saving message event:`, error);
  }
}

async function handleFileShared({ eventId, event }) {
  const channelId = event.channel_id;
  if (!channelId || (config.slackChannelId && channelId !== config.slackChannelId)) {
    return;
  }

  await saveFileEvent({
    eventId,
    channelId,
    userId: event.user_id,
    fileId: event.file_id,
    fileName: event.file?.name || 'Unknown',
    eventTs: slackTsToDate(event.event_ts || event.ts),
    rawEvent: event,
  });
}

async function processSlackEvent(payload) {
  const { event, event_id: eventId } = payload;
  if (!event || !eventId) {
    return;
  }

  // Log all incoming events for debugging
  console.log(`📥 Received event: ${event.type} (event_id: ${eventId})`);

  switch (event.type) {
    case 'reaction_added':
      await handleReactionAdded({ eventId, event });
      break;
    case 'member_joined_channel':
      await handleMemberJoined({ eventId, event });
      break;
    case 'member_left_channel':
      await handleMemberLeft({ eventId, event });
      break;
    case 'message':
      // Handle messages from channels (when subscribed to message.channels)
      // The event type is still 'message' but subscription is 'message.channels'
      console.log(`💬 Processing message event from channel: ${event.channel}`);
      await handleMessage({ eventId, event });
      break;
    case 'file_shared':
      await handleFileShared({ eventId, event });
      break;
    default:
      console.log(`⚠️  Unhandled event type: ${event.type}`);
      break;
  }
}

module.exports = {
  processSlackEvent,
};

