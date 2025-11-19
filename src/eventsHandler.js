/**
 * EVENTS_HANDLER.JS - Handles Incoming Slack Events
 * 
 * This file processes events that Slack sends to our server.
 * When something happens in Slack (reaction added, message sent, etc.),
 * Slack sends an event to our server, and this file decides what to do with it.
 * 
 * Flow:
 * 1. Slack sends event → server.js receives it
 * 2. server.js calls processSlackEvent() from this file
 * 3. This file checks what type of event it is
 * 4. Calls the appropriate handler function
 * 5. Handler function saves the event to database
 */

// Import config to check which channel we're monitoring
const config = require('./config');
// Import functions to save events to database
const { saveReactionEvent, saveMemberEvent, saveMessageEvent, saveFileEvent } = require('./eventsStore');

/**
 * Convert Slack timestamp to JavaScript Date object
 * 
 * Slack timestamps are in seconds (e.g., 1234567890.123456)
 * JavaScript Date needs milliseconds, so we multiply by 1000
 * 
 * @param {string|number} eventTs - Slack timestamp (in seconds)
 * @returns {Date} - JavaScript Date object
 * 
 * Example: slackTsToDate("1234567890") returns Date object for that time
 */
function slackTsToDate(eventTs) {
  if (!eventTs) return new Date();           // If no timestamp, return current time
  const millis = Number(eventTs) * 1000;     // Convert seconds to milliseconds
  return new Date(millis);                   // Create Date object
}

/**
 * Handle when someone adds a reaction (emoji) to a message
 * 
 * @param {object} params - Event data
 * @param {string} params.eventId - Unique ID for this event
 * @param {object} params.event - Full event data from Slack
 * 
 * Example event:
 * {
 *   type: "reaction_added",
 *   user: "U12345",
 *   reaction: "thumbsup",
 *   item: { channel: "C09SUH2KHK2" },
 *   event_ts: "1234567890.123456"
 * }
 */
async function handleReactionAdded({ eventId, event }) {
  // Get the channel ID from the event
  // event.item?.channel means "get channel from event.item, but if item doesn't exist, return undefined"
  const channelId = event.item?.channel;
  if (!channelId) {
    console.log('❌ Reaction event skipped: Missing channel ID');
    return;
  }

  try {
    await saveReactionEvent({
      eventId,
      channelId,
      userId: event.user,
      reaction: event.reaction,
      eventTs: slackTsToDate(event.event_ts),
      rawEvent: event,
    });
    console.log(`✅ Reaction event saved: ${eventId} (channel ${channelId})`);
  } catch (error) {
    console.error(`❌ Error saving reaction event ${eventId}:`, error.message);
  }
}

/**
 * Handle when someone joins the channel
 * 
 * @param {object} params - Event data
 * @param {string} params.eventId - Unique ID for this event
 * @param {object} params.event - Full event data from Slack
 * 
 * Example event:
 * {
 *   type: "member_joined_channel",
 *   user: "U12345",
 *   channel: "C09SUH2KHK2",
 *   event_ts: "1234567890.123456"
 * }
 */
async function handleMemberJoined({ eventId, event }) {
  // Get the channel ID from the event
  const channelId = event.channel;
  if (!channelId) {
    console.log('❌ Member joined event skipped: Missing channel ID');
    return;
  }

  try {
    await saveMemberEvent({
      eventId,
      channelId,
      userId: event.user,
      eventType: event.type,
      eventTs: slackTsToDate(event.event_ts || event.ts),
      rawEvent: event,
    });
    console.log(`✅ Member joined event saved: ${eventId} (channel ${channelId})`);
  } catch (error) {
    console.error(`❌ Error saving member joined event ${eventId}:`, error.message);
  }
}

/**
 * Handle when someone leaves the channel
 * 
 * @param {object} params - Event data
 * @param {string} params.eventId - Unique ID for this event
 * @param {object} params.event - Full event data from Slack
 * 
 * Example event:
 * {
 *   type: "member_left_channel",
 *   user: "U12345",
 *   channel: "C09SUH2KHK2",
 *   event_ts: "1234567890.123456"
 * }
 */
async function handleMemberLeft({ eventId, event }) {
  // Get the channel ID from the event
  const channelId = event.channel;
  if (!channelId) {
    console.log('❌ Member left event skipped: Missing channel ID');
    return;
  }

  try {
    await saveMemberEvent({
      eventId,
      channelId,
      userId: event.user,
      eventType: event.type,
      eventTs: slackTsToDate(event.event_ts || event.ts),
      rawEvent: event,
    });
    console.log(`✅ Member left event saved: ${eventId} (channel ${channelId})`);
  } catch (error) {
    console.error(`❌ Error saving member left event ${eventId}:`, error.message);
  }
}

/**
 * Handle when someone sends a message in the channel
 * 
 * @param {object} params - Event data
 * @param {string} params.eventId - Unique ID for this event
 * @param {object} params.event - Full message event data from Slack
 * 
 * Example event:
 * {
 *   type: "message",
 *   user: "U12345",
 *   channel: "C09SUH2KHK2",
 *   text: "Hello world!",
 *   ts: "1234567890.123456"
 * }
 */
async function handleMessage({ eventId, event }) {
  // Get the channel ID from the event
  const channelId = event.channel;
  
  // Debug logging - helps us see what's happening when testing
  console.log(`🔍 Message event details:`, {
    channelId,                              // Which channel
    targetChannel: config.slackChannelId,   // Which channel we're monitoring
    hasSubtype: !!event.subtype,            // Does this message have a subtype? (edit, delete, etc.)
    hasBotId: !!event.bot_id,               // Is this from a bot?
    userId: event.user,                     // Who sent it
  });

  // Only process messages from our target channel
  if (!channelId) {
    console.log(`❌ Message skipped: Missing channel ID`);
    return;  // Exit if not our channel
  }

  // Skip bot messages and message subtypes
  // Subtypes include: message_changed (edit), message_deleted, etc.
  // We only want to count regular user messages, not bot messages or edits
  if (event.subtype || event.bot_id) {
    console.log(`⏭️  Message skipped: Bot message or subtype (${event.subtype || 'bot_id'})`);
    return;  // Exit, don't save this message
  }

  // Try to save the message event to database
  try {
    await saveMessageEvent({
      eventId,                                    // Unique event ID
      channelId,                                  // Which channel
      userId: event.user,                         // Who sent the message
      eventTs: slackTsToDate(event.event_ts || event.ts),  // When it was sent
      rawEvent: event,                            // Full message data
    });
    console.log(`✅ Message event saved: ${eventId} (channel ${channelId})`);
  } catch (error) {
    // If something goes wrong, log the error but don't crash the server
    console.error(`❌ Error saving message event ${eventId}:`, error.message);
  }
}

/**
 * Handle when someone uploads a file to the channel
 * 
 * @param {object} params - Event data
 * @param {string} params.eventId - Unique ID for this event
 * @param {object} params.event - Full file event data from Slack
 * 
 * Example event:
 * {
 *   type: "file_shared",
 *   user_id: "U12345",
 *   channel_id: "C09SUH2KHK2",
 *   file_id: "F12345",
 *   file: { name: "document.pdf" },
 *   event_ts: "1234567890.123456"
 * }
 */
async function handleFileShared({ eventId, event }) {
  // Get the channel ID from the event
  // Note: file events use "channel_id" instead of "channel"
  const channelId = event.channel_id;
  
  // Only process events from our target channel
  if (!channelId) {
    console.log(`❌ File event skipped: Missing channel ID`);
    return;
  }

  // Save the file upload event to database
  try {
    await saveFileEvent({
      eventId,                                    // Unique event ID
      channelId,                                  // Which channel
      userId: event.user_id,                      // Who uploaded (note: file events use "user_id")
      fileId: event.file_id,                      // Slack's file ID
      fileName: event.file?.name || 'Unknown',    // File name, or "Unknown" if not available
      eventTs: slackTsToDate(event.event_ts || event.ts),  // When it was uploaded
      rawEvent: event,                            // Full event data
    });
    console.log(`✅ File event saved: ${eventId} (channel ${channelId})`);
  } catch (error) {
    console.error(`❌ Error saving file event ${eventId}:`, error.message);
  }
}

/**
 * Main function to process any Slack event
 * This is called by server.js when Slack sends us an event
 * 
 * @param {object} payload - The full payload from Slack
 * 
 * Example payload:
 * {
 *   type: "event_callback",
 *   event_id: "Ev12345",
 *   event: {
 *     type: "reaction_added",
 *     user: "U12345",
 *     ...
 *   }
 * }
 */
async function processSlackEvent(payload) {
  // Extract the event and event_id from the payload
  // Destructuring: const { event, event_id: eventId } means:
  // - Get "event" from payload and call it "event"
  // - Get "event_id" from payload and call it "eventId"
  const { event, event_id: eventId } = payload;
  
  // If there's no event or event_id, we can't process it
  if (!event || !eventId) {
    return;  // Exit early
  }

  // Log what event we received (helps with debugging)
  console.log(`📥 Received event: ${event.type} (event_id: ${eventId})`);

  // Use switch statement to handle different event types
  // Think of it like: "If event type is X, do Y"
  switch (event.type) {
    // Someone added a reaction (emoji) to a message
    case 'reaction_added':
      await handleReactionAdded({ eventId, event });
      break;
    
    // Someone joined the channel
    case 'member_joined_channel':
      await handleMemberJoined({ eventId, event });
      break;
    
    // Someone left the channel
    case 'member_left_channel':
      await handleMemberLeft({ eventId, event });
      break;
    
    // Someone sent a message
    case 'message':
      // Note: When subscribed to "message.channels", Slack still sends type "message"
      // but it only sends messages from public channels
      console.log(`💬 Processing message event from channel: ${event.channel}`);
      await handleMessage({ eventId, event });
      break;
    
    // Someone uploaded a file
    case 'file_shared':
      await handleFileShared({ eventId, event });
      break;
    
    // If we get an event type we don't know how to handle, just log it
    default:
      console.log(`⚠️  Unhandled event type: ${event.type}`);
      break;
  }
}

// Export the main function so server.js can use it
module.exports = {
  processSlackEvent,  // This is the main function that processes all Slack events
};

