/**
 * Chat Cloud Functions
 * 
 * Handles AI chat completions via OpenAI API
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { observeOpenAI } from 'langfuse';
import OpenAI from 'openai';
import type { ChatCompletion } from 'openai/resources/chat';
import { CHAT_MESSAGE_HISTORY_HOURS, CHAT_REMINDER_PROMPT, CHAT_SYSTEM_PROMPT, FUNCTION_TIMEOUTS, OPENAI_MODEL } from './constants';
import { logger } from './logger';
import { createTimeoutMonitor } from './timeout-monitor';
import type {
  BossSchema,
  EmailSchema,
  EntrySchema,
  UserSchema,
} from '../../firestore/schemas';
import type {
  ChatCompletionMessageParam,
  ContentItem,
  FirestoreChatMessage,
  GenerateChatResponseRequest,
  GenerateChatResponseResponse,
} from './types/chat.types';

/**
 * Field metadata type extracted from schema
 */
type FieldMetadata = {
  label: string;
  type: 'text' | 'select' | 'date' | 'multiline' | 'multiselect';
  category?: string;
  source?: 'onboarding_funnel' | 'user_added';
  createdAt: string;
  displayOrder?: number;
  options?: string[];
};

/**
 * Define the OpenAI API key secret
 */
const openaiApiKey = defineSecret('OPENAI_API_KEY');

/**
 * Define LangFuse secrets for tracing
 */
const langfusePublicKey = defineSecret('LANGFUSE_PUBLIC_KEY');
const langfuseSecretKey = defineSecret('LANGFUSE_SECRET_KEY');

/**
 * Check if user is actively viewing a specific screen
 * Uses presence tracking with 2-minute timeout for crash detection
 * 
 * @param userData - User document data
 * @param screenName - Screen to check ('chat', 'support', etc)
 * @returns true if user is actively in the screen
 */
function isUserActiveInScreen(
  userData: UserSchema | undefined,
  screenName: string
): boolean {
  if (userData?.currentScreen !== screenName) return false;
  if (!userData?.lastActivityAt) return false;
  
  const TWO_MINUTES_MS = 2 * 60 * 1000;
  const lastActivity = new Date(userData.lastActivityAt).getTime();
  return (Date.now() - lastActivity) < TWO_MINUTES_MS;
}

/**
 * Convert Firestore message to OpenAI format
 * Strips the timestamp field which is not needed for the API
 */
function toOpenAIMessage(message: FirestoreChatMessage): ChatCompletionMessageParam {
  return {
    role: message.role,
    content: message.content,
  } as ChatCompletionMessageParam;
}

/**
 * Convert OpenAI response to Firestore message format
 * Handles both string and array content formats from OpenAI
 */
function fromOpenAIResponse(response: ChatCompletion): FirestoreChatMessage {
  const aiMessage = response.choices[0].message;
  
  // Convert string content to multimodal array format
  let content: ContentItem[];
  
  if (typeof aiMessage.content === 'string') {
    content = [{ type: 'text', text: aiMessage.content }];
  } else if (aiMessage.content === null) {
    content = [{ type: 'text', text: '' }];
  } else {
    content = aiMessage.content as ContentItem[];
  }
  
  return {
    role: 'assistant',
    content,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Filter messages to only include recent ones within the time window
 * System messages are always included regardless of timestamp
 */
function getRecentMessages(
  messages: FirestoreChatMessage[],
  hoursWindow: number
): FirestoreChatMessage[] {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - hoursWindow);
  const cutoffISO = cutoffTime.toISOString();
  
  return messages.filter((message) => {
    // Always include system messages
    if (message.role === 'system') {
      return true;
    }
    // Include messages within the time window
    return message.timestamp >= cutoffISO;
  });
}

/**
 * Fetch all user context data (profile, bosses, timeline entries)
 * Returns formatted string for system message
 */
async function fetchUserContext(userId: string): Promise<string> {
  const db = admin.firestore();
  
  // Fetch user profile
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  
  // Fetch all bosses
  const bossesSnapshot = await db.collection('users').doc(userId)
    .collection('bosses')
    .orderBy('createdAt', 'asc')
    .get();
  
  const bossesData: Array<BossSchema & { id: string }> = [];
  
  // Collect all bosses (without entries nested inside)
  for (const bossDoc of bossesSnapshot.docs) {
    const bossData = { id: bossDoc.id, ...bossDoc.data() as BossSchema };
    bossesData.push(bossData);
  }
  
  // Fetch all timeline entries from user level
  const entriesSnapshot = await db
    .collection('users').doc(userId)
    .collection('entries')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .get();
  
  const entries: Array<EntrySchema & { id: string }> = [];
  entriesSnapshot.forEach((entryDoc) => {
    entries.push({ id: entryDoc.id, ...entryDoc.data() as EntrySchema });
  });
  
  // Fetch last 15 sent emails
  const emailsSnapshot = await db
    .collection('users').doc(userId)
    .collection('emails')
    .where('state', '==', 'SENT')
    .orderBy('sentAt', 'desc')
    .limit(15)
    .get();
  
  const emails: Array<EmailSchema & { id: string }> = [];
  emailsSnapshot.forEach((emailDoc) => {
    emails.push({ id: emailDoc.id, ...emailDoc.data() as EmailSchema });
  });
  
  // Build context string
  const contextParts: string[] = [];
  
  // User profile info
  if (userData) {
    contextParts.push('## User Profile');
    contextParts.push(`User ID: ${userId}`);
    contextParts.push(`Name: ${userData.name || 'Not set'}`);
    contextParts.push(`Position: ${userData.position || 'Not set'}`);
    contextParts.push(`Goal: ${userData.goal || 'Not set'}`);
    
    // Add custom fields if they exist
    if (userData._fieldsMeta) {
      contextParts.push('\n### Custom Profile Fields');
      for (const [fieldKey, fieldMetaValue] of Object.entries(userData._fieldsMeta)) {
        const fieldMeta = fieldMetaValue as FieldMetadata;
        // userData is a Record so we can safely access any key
        const fieldValue = userData[fieldKey as keyof UserSchema];
        if (fieldValue !== undefined && fieldValue !== null) {
          contextParts.push(`${fieldMeta.label}: ${fieldValue}`);
        }
      }
    }
  }
  
  // Bosses and their data
  if (bossesData.length > 0) {
    contextParts.push('\n## Bosses');
    
    for (const boss of bossesData) {
      contextParts.push(`\n### Boss: ${boss.name || 'Unnamed'}`);
      contextParts.push(`Position: ${boss.position || 'Not set'}`);
      contextParts.push(`Department: ${boss.department || 'Not set'}`);
      contextParts.push(`Management Style: ${boss.managementStyle || 'Not set'}`);
      contextParts.push(`Working Hours: ${boss.workingHours || 'Not set'}`);
      contextParts.push(`Started At: ${boss.startedAt || 'Not set'}`);
      
      // Add custom fields if they exist
      if (boss._fieldsMeta) {
        contextParts.push('\n#### Custom Boss Fields');
        for (const [fieldKey, fieldMetaValue] of Object.entries(boss._fieldsMeta)) {
          const fieldMeta = fieldMetaValue as FieldMetadata;
          // boss is a Record so we can safely access any key
          const fieldValue = boss[fieldKey as keyof BossSchema];
          if (fieldValue !== undefined && fieldValue !== null) {
            contextParts.push(`${fieldMeta.label}: ${fieldValue}`);
          }
        }
      }
    }
  }
  
  // Add timeline entries
  if (entries.length > 0) {
    contextParts.push('\n## Timeline Entries (Recent)');
    for (const entry of entries) {
      const entryType = entry.type === 'note' ? `Note (${entry.subtype})` : 'Entry';
      contextParts.push(`- [${entry.timestamp}] ${entryType}: ${entry.title}`);
      if (entry.content) {
        contextParts.push(`  Content: ${entry.content}`);
      }
    }
  }
  
  // Add sent email history
  if (emails.length > 0) {
    contextParts.push('\n## Previous Email Notifications Sent to User');
    for (const email of emails) {
      contextParts.push(`\n### Email sent at ${email.sentAt}`);
      contextParts.push(`Subject: ${email.subject}`);
      contextParts.push(`Body:\n${email.body_markdown}`);
    }
  }
  
  return contextParts.join('\n');
}


/**
 * Generate AI chat response
 * 
 * Cloud Function that:
 * 1. Receives user message information
 * 2. Retrieves message history (last 24 hours)
 * 3. Calls OpenAI API with system prompt and history
 * 4. Saves AI response to Firestore
 * 5. Manages typing indicator and generation cancellation
 */
export const generateChatResponse = onCall<GenerateChatResponseRequest, Promise<GenerateChatResponseResponse>>(
  {
    region: 'us-central1',
    invoker: 'private', // Requires authentication
    timeoutSeconds: FUNCTION_TIMEOUTS.generateChatResponse,
    memory: '512MiB', // Increased for large context processing
    secrets: [openaiApiKey, langfusePublicKey, langfuseSecretKey], // Declare the secrets
  },
  async (request) => {
    const { userId, threadId, messageId, sessionId, currentDateTimeUTC, currentDateTimeLocal } = request.data;
    
    // Create timeout monitor
    const timeout = createTimeoutMonitor(FUNCTION_TIMEOUTS.generateChatResponse);
    
    // Initialize OpenAI client with LangFuse observability wrapper
    const openai = observeOpenAI(
      new OpenAI({
        apiKey: openaiApiKey.value().trim(),
      }),
      {
        generationName: 'chat_completion',
        // Use sessionId for LangFuse session grouping (app visits)
        // Fall back to threadId if sessionId is not provided
        sessionId: sessionId || threadId,
        // Use userId for LangFuse user grouping
        userId: userId,
        // Put threadId and messageId in metadata
        metadata: {
          threadId,
          messageId,
        },
        clientInitParams: {
          publicKey: langfusePublicKey.value().trim(),
          secretKey: langfuseSecretKey.value().trim(),
          baseUrl: 'https://us.cloud.langfuse.com',
        },
      }
    );
    
    // Verify authentication
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to generate chat responses'
      );
    }
    
    // Verify user is requesting their own data
    if (request.auth.uid !== userId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Cannot generate responses for other users'
      );
    }
    
    logger.info('Starting chat response generation', {
      userId,
      threadId,
      messageId,
    });
    
    const db = admin.firestore();
    const threadRef = db.collection('users').doc(userId)
      .collection('chatThreads').doc(threadId);
    const messagesRef = threadRef.collection('messages');
    
    // Generate unique ID for this generation request
    const generationId = crypto.randomUUID();
    
    try {
      // Set typing indicator and generation ID
      await threadRef.update({
        assistantIsTyping: true,
        currentGenerationId: generationId,
      });
      
      logger.debug('Typing indicator set', { userId, threadId, generationId });
      
      // Retrieve all messages from Firestore
      const messagesSnapshot = await messagesRef
        .orderBy('timestamp', 'asc')
        .get();
      
      const allMessages: FirestoreChatMessage[] = [];
      messagesSnapshot.forEach((doc) => {
        allMessages.push(doc.data() as FirestoreChatMessage);
      });
      
      logger.debug('Retrieved messages from Firestore', {
        userId,
        threadId,
        totalMessages: allMessages.length,
      });
      
      // Filter to recent messages only
      const recentMessages = getRecentMessages(allMessages, CHAT_MESSAGE_HISTORY_HOURS);
      
      logger.debug('Filtered to recent messages', {
        userId,
        threadId,
        recentMessages: recentMessages.length,
        hoursWindow: CHAT_MESSAGE_HISTORY_HOURS,
      });
      
      // Check if generation was cancelled (user sent another message)
      const threadSnapshot = await threadRef.get();
      const threadData = threadSnapshot.data();
      
      if (!threadData || threadData.currentGenerationId !== generationId) {
        logger.info('Generation cancelled - new message received', {
          userId,
          threadId,
          generationId,
          currentId: threadData?.currentGenerationId,
        });
        return {
          success: false,
          error: 'Generation cancelled due to new message',
          errorCode: 'GENERATION_CANCELLED',
        };
      }
      
      logger.debug('Fetching user context', { userId, threadId });
      
      await timeout.check('Fetching user context');
      
      // Fetch user context
      const userContext = await fetchUserContext(userId);
      
      logger.debug('User context fetched', { 
        userId, 
        threadId, 
        contextLength: userContext.length 
      });
      
      // Prepare messages for OpenAI with 4-layer structure:
      // 1. Main system prompt
      // 2. User context wrapped in <user-info> tags
      // 3. Recent messages (last 24 hours)
      // 4. Date/time information
      // 5. Reminder prompt
      
      const systemMessageMain: FirestoreChatMessage = {
        role: 'system',
        content: [{ type: 'text', text: CHAT_SYSTEM_PROMPT }],
        timestamp: new Date().toISOString(),
      };
      
      const systemMessageUserData: FirestoreChatMessage = {
        role: 'system',
        content: [{ type: 'text', text: `<user-info>\n${userContext}\n</user-info>` }],
        timestamp: new Date().toISOString(),
      };
      
      const systemMessageReminder: FirestoreChatMessage = {
        role: 'system',
        content: [{ type: 'text', text: CHAT_REMINDER_PROMPT }],
        timestamp: new Date().toISOString(),
      };
      
      // Calculate time since previous user message (not the current one that triggered this function)
      const userMessages = recentMessages.filter((m) => m.role === 'user');
      let timeSinceLastMessageText = '';
      
      if (userMessages.length >= 2) {
        // Take the second-to-last message (the one before the current message that triggered this function)
        const previousUserMessage = userMessages[userMessages.length - 2];
        const previousMessageTime = new Date(previousUserMessage.timestamp);
        const currentTime = new Date(currentDateTimeUTC || new Date().toISOString());
        const diffMs = currentTime.getTime() - previousMessageTime.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        // Only add time info if more than 30 minutes passed
        if (diffMinutes > 30) {
          const hours = Math.floor(diffMinutes / 60);
          const days = Math.floor(hours / 24);
          
          if (days > 0) {
            const remainingHours = hours % 24;
            timeSinceLastMessageText = `Time since user's previous message (before the current one): ${days} day${days > 1 ? 's' : ''}${remainingHours > 0 ? ` ${remainingHours} hour${remainingHours > 1 ? 's' : ''}` : ''}\n`;
          } else if (hours > 0) {
            const remainingMinutes = diffMinutes % 60;
            timeSinceLastMessageText = `Time since user's previous message (before the current one): ${hours} hour${hours > 1 ? 's' : ''}${remainingMinutes > 0 ? ` ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}` : ''}\n`;
          } else {
            timeSinceLastMessageText = `Time since user's previous message (before the current one): ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}\n`;
          }
        }
      }
      
      const systemMessageTimes: FirestoreChatMessage = {
        role: 'system',
        content: [{
          type: 'text',
          text: `${timeSinceLastMessageText}Current date and time (UTC): ${currentDateTimeUTC || 'not available'}\nCurrent date and time (user's timezone): ${currentDateTimeLocal || 'not available'}`,
        }],
        timestamp: new Date().toISOString(),
      };
      
      const messagesForOpenAI: ChatCompletionMessageParam[] = [
        toOpenAIMessage(systemMessageMain),
        toOpenAIMessage(systemMessageUserData),
        ...recentMessages.map(toOpenAIMessage),
        toOpenAIMessage(systemMessageTimes),
        toOpenAIMessage(systemMessageReminder),
      ];
      
      logger.info('Calling OpenAI API', {
        userId,
        threadId,
        model: OPENAI_MODEL,
        messageCount: messagesForOpenAI.length,
        systemMessagesCount: 4,
        userMessagesCount: recentMessages.length,
      });
      
      await timeout.check('Calling OpenAI API');
      
      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: messagesForOpenAI,
        user: userId, // Unique identifier for end-user abuse tracking
      });
      
      logger.info('Received response from OpenAI', {
        userId,
        threadId,
        finishReason: response.choices[0].finish_reason,
        tokensUsed: response.usage?.total_tokens,
      });
      
      // Check again if generation was cancelled before saving
      const threadSnapshot2 = await threadRef.get();
      const threadData2 = threadSnapshot2.data();
      
      if (!threadData2 || threadData2.currentGenerationId !== generationId) {
        logger.info('Generation cancelled before saving - new message received', {
          userId,
          threadId,
          generationId,
          currentId: threadData2?.currentGenerationId,
        });
        return {
          success: false,
          error: 'Generation cancelled due to new message',
          errorCode: 'GENERATION_CANCELLED',
        };
      }
      
      // Convert OpenAI response to Firestore format
      const assistantMessage = fromOpenAIResponse(response);
      
      // Save AI response to Firestore
      const messageRef = await messagesRef.add(assistantMessage);
      
      logger.info('Saved assistant message to Firestore', {
        userId,
        threadId,
        messageId: messageRef.id,
      });
      
      // Update thread metadata
      await threadRef.update({
        assistantIsTyping: false,
        updatedAt: assistantMessage.timestamp,
        messageCount: admin.firestore.FieldValue.increment(1),
      });
      
      logger.info('Chat response generation completed successfully', {
        userId,
        threadId,
        messageId: messageRef.id,
      });
      
      // Flush LangFuse events to ensure they are sent
      try {
        await openai.flushAsync();
      } catch (flushError) {
        logger.warn('Failed to flush LangFuse events', { flushError });
      }
      
      return {
        success: true,
        messageId: messageRef.id,
      };
      
    } catch (error) {
      // Reset typing indicator on error
      await threadRef.update({
        assistantIsTyping: false,
      }).catch((updateError) => {
        logger.error('Failed to reset typing indicator', {
          userId,
          threadId,
          error: updateError,
        });
      });
      
      logger.error('Error generating chat response', {
        userId,
        threadId,
        error,
      });
      
      // Flush LangFuse events even on error
      try {
        await openai.flushAsync();
      } catch (flushError) {
        logger.warn('Failed to flush LangFuse events on error', { flushError });
      }
      
      // Throw user-friendly error
      throw new functions.https.HttpsError(
        'internal',
        'Failed to generate chat response. Please try again.'
      );
    }
  }
);

/**
 * Firestore Trigger: Update unread count when new assistant message is created
 * 
 * Triggers on any new message creation and:
 * 1. Checks if message is from assistant
 * 2. Increments unreadCount in thread
 * 3. Updates lastMessageAt and lastMessageRole
 * 
 * This handles all scenarios:
 * - AI responses from generateChatResponse
 * - Manual message additions in Firebase Console
 * - Background processes adding messages
 */
export const onChatMessageCreated = onDocumentCreated(
  {
    document: 'users/{userId}/chatThreads/{threadId}/messages/{messageId}',
    region: 'us-central1',
    timeoutSeconds: 60, // 1 minute for unread count update + FCM push notification
    memory: '256MiB', // Default is sufficient
  },
  async (event) => {
    const messageData = event.data?.data() as FirestoreChatMessage | undefined;
    
    if (!messageData) {
      logger.warn('No message data in trigger', { eventId: event.id });
      return;
    }
    
    const { userId, threadId, messageId } = event.params;
    
    logger.debug('Message created trigger fired', {
      userId,
      threadId,
      messageId,
      role: messageData.role,
    });
    
    // Only process assistant messages for unread counter
    if (messageData.role !== 'assistant') {
      logger.debug('Skipping non-assistant message', {
        userId,
        threadId,
        messageId,
        role: messageData.role,
      });
      return;
    }
    
    const db = admin.firestore();
    const threadRef = db.collection('users').doc(userId)
      .collection('chatThreads').doc(threadId);
    
    try {
      // Check if user is actively in chat screen
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data() as UserSchema | undefined;
      
      if (isUserActiveInScreen(userData, 'chat')) {
        logger.info('User is actively in chat, skipping notification and unread count', {
          userId,
          threadId,
          messageId,
          currentScreen: userData?.currentScreen,
          lastActivityAt: userData?.lastActivityAt,
        });
        return;
      }
      
      // Update thread with unread count and last message info
      await threadRef.update({
        unreadCount: admin.firestore.FieldValue.increment(1),
        lastMessageAt: messageData.timestamp,
        lastMessageRole: messageData.role,
      });
      
      logger.info('Updated unread count for assistant message', {
        userId,
        threadId,
        messageId,
      });
      
      // Send push notification if user has FCM token
      const fcmToken = userData?.fcmToken;
      
      if (fcmToken) {
        // Extract text from message content
        const messageText = messageData.content
          .filter((item: ContentItem) => item.type === 'text' && item.text)
          .map((item: ContentItem) => item.text)
          .join(' ');
        
        // Truncate message for notification
        const preview = messageText.length > 100 
          ? messageText.substring(0, 97) + '...' 
          : messageText;
        
        try {
          await admin.messaging().send({
            token: fcmToken,
            notification: {
              title: 'New message from AI Assistant',
              body: preview,
            },
            data: {
              type: 'chat_message',
              threadId: threadId,
              messageId: messageId,
            },
            apns: {
              payload: {
                aps: {
                  badge: 1, // Will be updated by client with actual count
                  sound: 'default',
                },
              },
            },
            android: {
              notification: {
                channelId: 'chat_messages',
                priority: 'high',
              },
            },
          });
          
          logger.info('Push notification sent', {
            userId,
          threadId,
          messageId,
        });
        } catch (notificationError: unknown) {
          logger.error('Failed to send push notification', {
            userId,
            threadId,
            messageId,
            error: notificationError,
          });
          
          // Remove invalid FCM token from Firestore
          // Only remove token for errors that definitely indicate invalid/expired token
          const invalidTokenErrors = [
            'messaging/invalid-registration-token',
            'messaging/registration-token-not-registered',
          ];
          
          // Type guard for error object with code and message
          const isErrorWithCodeAndMessage = (
            error: unknown
          ): error is { code: string; message: string } => {
            return (
              typeof error === 'object' &&
              error !== null &&
              'code' in error &&
              'message' in error &&
              typeof (error as { code: unknown }).code === 'string' &&
              typeof (error as { message: unknown }).message === 'string'
            );
          };
          
          // Also handle cases where FCM API returns 404 for token not found
          // Error message from FCM: "Requested entity was not found"
          const isTokenNotFoundError = 
            isErrorWithCodeAndMessage(notificationError) &&
            (notificationError.message.includes('Requested entity was not found') ||
             notificationError.message.includes('registration token not found'));
          
          const shouldRemoveToken = 
            (isErrorWithCodeAndMessage(notificationError) && 
             invalidTokenErrors.includes(notificationError.code)) || 
            isTokenNotFoundError;
          
          if (shouldRemoveToken) {
            logger.info('Removing invalid FCM token', { 
              userId, 
              errorCode: isErrorWithCodeAndMessage(notificationError) ? notificationError.code : undefined,
              errorMessage: isErrorWithCodeAndMessage(notificationError) ? notificationError.message : undefined,
            });
            try {
              await db.collection('users').doc(userId).update({
                fcmToken: null,
              });
            } catch (updateError) {
              logger.error('Failed to remove invalid FCM token', { userId, error: updateError });
            }
          }
        }
      } else {
        logger.debug('No FCM token for user, skipping push notification', {
          userId,
          threadId,
          messageId,
        });
      }
    } catch (error) {
      logger.error('Failed to update unread count', {
        userId,
        threadId,
        messageId,
        error,
      });
    }
  }
);

