/**
 * Chat Cloud Functions
 * 
 * Handles AI chat completions via OpenAI API
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onCall } from 'firebase-functions/v2/https';
import OpenAI from 'openai';
import type { ChatCompletion } from 'openai/resources/chat';
import { CHAT_MESSAGE_HISTORY_HOURS, CHAT_SYSTEM_PROMPT, OPENAI_MODEL } from './constants';
import type {
    ChatCompletionMessageParam,
    ContentItem,
    FirestoreChatMessage,
    GenerateChatResponseRequest,
    GenerateChatResponseResponse,
} from './types/chat.types';

/**
 * Define the OpenAI API key secret
 */
const openaiApiKey = defineSecret('OPENAI_API_KEY');

/**
 * Logger utility (mimics client logger service for Cloud Functions)
 */
const logger = {
  info: (message: string, context: Record<string, unknown>) => {
    console.log(`[INFO] ${message}`, JSON.stringify(context));
  },
  error: (message: string, context: Record<string, unknown>) => {
    console.error(`[ERROR] ${message}`, JSON.stringify(context));
  },
  warn: (message: string, context: Record<string, unknown>) => {
    console.warn(`[WARN] ${message}`, JSON.stringify(context));
  },
  debug: (message: string, context: Record<string, unknown>) => {
    console.log(`[DEBUG] ${message}`, JSON.stringify(context));
  },
};

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
    secrets: [openaiApiKey], // Declare the secret
  },
  async (request) => {
    const { userId, threadId, messageId } = request.data;
    
    // Initialize OpenAI client with secret (trim to remove any whitespace)
    const openai = new OpenAI({
      apiKey: openaiApiKey.value().trim(),
    });
    
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
        };
      }
      
      // Prepare messages for OpenAI (add system prompt first)
      const systemMessage: FirestoreChatMessage = {
        role: 'system',
        content: [{ type: 'text', text: CHAT_SYSTEM_PROMPT }],
        timestamp: new Date().toISOString(),
      };
      
      const messagesForOpenAI: ChatCompletionMessageParam[] = [
        toOpenAIMessage(systemMessage),
        ...recentMessages.map(toOpenAIMessage),
      ];
      
      logger.info('Calling OpenAI API', {
        userId,
        threadId,
        model: OPENAI_MODEL,
        messageCount: messagesForOpenAI.length,
      });
      
      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: messagesForOpenAI,
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
      
      // Throw user-friendly error
      throw new functions.https.HttpsError(
        'internal',
        'Failed to generate chat response. Please try again.'
      );
    }
  }
);

