import { db, functions } from '@/constants/firebase.config';
import { 
  ChatMessage, 
  ChatThread, 
  ContentItem, 
  GenerateChatResponseRequest,
  GenerateChatResponseResponse,
  LoadMessagesResult, 
  Unsubscribe 
} from '@/types';
import { isExpectedFirebaseError, isFirebaseOfflineError } from '@/utils/firebaseErrors';
import { retryWithBackoff } from '@/utils/retryWithBackoff';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAt,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { logger } from './logger.service';

/**
 * Helper function to create text-only content array
 */
export function createTextContent(text: string): ContentItem[] {
  return [
    {
      type: 'text',
      text: text,
    },
  ];
}

/**
 * Helper function to extract text from content array
 */
export function extractTextFromContent(content: ContentItem[]): string {
  return content
    .filter((item) => item.type === 'text' && item.text)
    .map((item) => item.text)
    .join(' ');
}

/**
 * Get or create the main chat thread for a user
 * For MVP, each user has a single thread with ID 'main'
 * 
 * @param userId - User ID
 * @returns Thread ID (always 'main' for MVP)
 */
export async function getOrCreateThread(userId: string): Promise<string> {
  logger.time('getOrCreateThread');
  logger.debug('Getting or creating chat thread', { feature: 'ChatService', userId });
  
  const threadId = 'main'; // Single thread per user for MVP
  
  try {
    // Ensure auth token is valid before first Firestore request
    // Prevents race condition where user opens chat immediately after login
    // and token is not yet ready. See utils/authGuard.ts for details.
    const { ensureAuthReady } = await import('@/utils/authGuard');
    await ensureAuthReady(userId);
    
    const result = await retryWithBackoff(async () => {
      const threadRef = doc(db, 'users', userId, 'chatThreads', threadId);
      const threadDoc = await getDoc(threadRef);
      
      if (!threadDoc.exists()) {
        // FALLBACK: Create new thread if it doesn't exist
        // Normally the thread is created synchronously during user creation
        // This is a safety fallback in case the creation failed
        
        // ⚠️ This should NOT happen in production - report to Sentry
        logger.error('FALLBACK TRIGGERED: Chat thread not found for user (should be unreachable)', {
          feature: 'ChatService',
          userId,
          threadId,
          error: new Error('Chat thread creation fallback triggered - Cloud Function may have failed'),
        });
        
        const now = new Date().toISOString();
        const newThread: ChatThread = {
          createdAt: now,
          updatedAt: now,
          messageCount: 0,
          assistantIsTyping: false,
          unreadCount: 0,
          lastReadAt: null,
          lastMessageAt: null,
          lastMessageRole: null,
        };
        
        await setDoc(threadRef, newThread);
        logger.info('Created chat thread via fallback', { feature: 'ChatService', userId, threadId });
      } else {
        logger.debug('Chat thread already exists', { feature: 'ChatService', userId, threadId });
      }
      
      return threadId;
    }, 3, 500);
    
    logger.timeEnd('getOrCreateThread', { feature: 'ChatService', userId, threadId: result });
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    
    if (isOffline) {
      logger.warn('Failed to get or create thread (offline)', {
        feature: 'ChatService',
        userId,
        retries: 3,
      });
    } else {
      logger.error('Error getting or creating thread', { feature: 'ChatService', userId, error: err });
    }
    
    throw error;
  }
}

/**
 * Subscribe to messages in a thread with real-time updates
 * 
 * @param userId - User ID
 * @param threadId - Thread ID
 * @param callback - Function to call with updated messages
 * @param messageLimit - Maximum number of recent messages to load (default: 20)
 * @returns Unsubscribe function
 */
export function subscribeToMessages(
  userId: string,
  threadId: string,
  callback: (messages: ChatMessage[]) => void,
  messageLimit: number = 20
): Unsubscribe {
  logger.debug('Subscribing to chat messages', { feature: 'ChatService', userId, threadId, limit: messageLimit });
  
  const messagesRef = collection(db, 'users', userId, 'chatThreads', threadId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(messageLimit));
  
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const messages: ChatMessage[] = [];
      
      snapshot.forEach((doc) => {
        messages.push(doc.data() as ChatMessage);
      });
      
      logger.debug('Received messages update', { 
        feature: 'ChatService', 
        userId, 
        threadId, 
        count: messages.length 
      });
      
      callback(messages);
    },
    (error) => {
      logger.error('Error in messages subscription', { 
        feature: 'ChatService', 
        userId, 
        threadId, 
        error 
      });
    }
  );
  
  return unsubscribe;
}

/**
 * Send a text message in a thread
 * Creates a user message with text content
 * 
 * @param userId - User ID
 * @param threadId - Thread ID
 * @param text - Message text
 * @returns Message ID of the created message
 */
export async function sendMessage(
  userId: string,
  threadId: string,
  text: string
): Promise<string> {
  logger.time('sendMessage');
  logger.debug('Sending message', { feature: 'ChatService', userId, threadId, textLength: text.length });
  
  try {
    const messageId = await retryWithBackoff(async () => {
      const messagesRef = collection(db, 'users', userId, 'chatThreads', threadId, 'messages');
      const threadRef = doc(db, 'users', userId, 'chatThreads', threadId);
      
      // Create the message
      const message: ChatMessage = {
        role: 'user',
        content: createTextContent(text),
        timestamp: new Date().toISOString(),
      };
      
      // Add message to collection
      const messageRef = await addDoc(messagesRef, message);
      
      // Update thread metadata
      const threadDoc = await getDoc(threadRef);
      if (threadDoc.exists()) {
        const threadData = threadDoc.data() as ChatThread;
        await updateDoc(threadRef, {
          updatedAt: message.timestamp,
          messageCount: threadData.messageCount + 1,
        });
      }
      
      logger.info('Message sent successfully', { feature: 'ChatService', userId, threadId, messageId: messageRef.id });
      return messageRef.id;
    }, 3, 500);
    
    logger.timeEnd('sendMessage', { feature: 'ChatService', userId, threadId, messageId });
    return messageId;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    
    if (isOffline) {
      logger.warn('Failed to send message (offline)', {
        feature: 'ChatService',
        userId,
        threadId,
        retries: 3,
      });
    } else {
      logger.error('Error sending message', { feature: 'ChatService', userId, threadId, error: err });
    }
    
    throw error;
  }
}

/**
 * Get all messages in a thread (for initial load without subscription)
 * 
 * @param userId - User ID
 * @param threadId - Thread ID
 * @returns Array of messages ordered by timestamp
 */
export async function getMessages(
  userId: string,
  threadId: string
): Promise<ChatMessage[]> {
  logger.time('getMessages');
  logger.debug('Getting messages', { feature: 'ChatService', userId, threadId });
  
  try {
    const result = await retryWithBackoff(async () => {
      const messagesRef = collection(db, 'users', userId, 'chatThreads', threadId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);
      
      const messages: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        messages.push(doc.data() as ChatMessage);
      });
      
      return messages;
    }, 3, 500);
    
    logger.timeEnd('getMessages', { feature: 'ChatService', userId, threadId, count: result.length });
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    
    if (isOffline) {
      logger.warn('Failed to get messages (offline), returning empty array', {
        feature: 'ChatService',
        userId,
        threadId,
        retries: 3,
      });
    } else {
      logger.error('Error getting messages', { feature: 'ChatService', userId, threadId, error: err });
    }
    
    return [];
  }
}

/**
 * Generate AI response for the latest user message
 * Calls Cloud Function which handles OpenAI API interaction
 * 
 * @param userId - User ID
 * @param threadId - Thread ID
 * @param messageId - ID of the user message to respond to
 * @param sessionId - Optional app session ID for LangFuse grouping
 */
export async function generateAIResponse(
  userId: string,
  threadId: string,
  messageId: string,
  sessionId?: string
): Promise<void> {
  logger.time('generateAIResponse');
  logger.debug('Requesting AI response', { feature: 'ChatService', userId, threadId, messageId, sessionId });
  
  try {
    // Capture current date/time from user's device
    const now = new Date();
    const currentDateTimeUTC = now.toISOString();
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Format local time with timezone offset (e.g., "2025-11-14T13:30:00+03:00")
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const offsetMinutes = -now.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetMins = Math.abs(offsetMinutes) % 60;
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const offset = `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;
    
    const currentDateTimeLocal = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offset}`;
    
    const generateChatResponse = httpsCallable<
      GenerateChatResponseRequest & {
        currentDateTimeUTC?: string;
        currentDateTimeLocal?: string;
        userTimezone?: string;
      },
      GenerateChatResponseResponse
    >(functions, 'generateChatResponse');
    
    const result = await generateChatResponse({ 
      userId, 
      threadId, 
      messageId, 
      sessionId,
      currentDateTimeUTC,
      currentDateTimeLocal,
      userTimezone,
    });
    
    if (!result.data.success) {
      const errorMessage = result.data.error || 'Failed to generate AI response';
      const errorCode = result.data.errorCode;
      
      // GENERATION_CANCELLED is expected when user sends new message before AI responds
      // Log as info and return gracefully instead of throwing error
      if (errorCode === 'GENERATION_CANCELLED') {
        logger.info('AI response generation cancelled', {
          feature: 'ChatService',
          userId,
          threadId,
          messageId,
          reason: errorMessage,
        });
        logger.timeEnd('generateAIResponse', { feature: 'ChatService', userId, threadId, cancelled: true });
        return;
      }
      
      logger.warn('AI response generation was not successful', {
        feature: 'ChatService',
        userId,
        threadId,
        messageId,
        error: errorMessage,
        errorCode,
      });
      throw new Error(errorMessage);
    }
    
    logger.info('AI response generated successfully', {
      feature: 'ChatService',
      userId,
      threadId,
      messageId,
      responseMessageId: result.data.messageId,
    });
    
    logger.timeEnd('generateAIResponse', { feature: 'ChatService', userId, threadId });
  } catch (error) {
    const err = error as Error;
    
    if (isExpectedFirebaseError(err)) {
      logger.warn('AI response generation failed with expected error', {
        feature: 'ChatService',
        userId,
        threadId,
        messageId,
        error: err,
      });
    } else {
      logger.error('Error generating AI response', {
        feature: 'ChatService',
        userId,
        threadId,
        messageId,
        error: err,
      });
    }
    
    throw error;
  }
}

/**
 * Load older messages for pagination
 * 
 * @param userId - User ID
 * @param threadId - Thread ID
 * @param oldestTimestamp - Timestamp of the oldest currently loaded message
 * @param batchLimit - Number of messages to load
 * @returns Object with messages array and hasMore flag
 */
export async function loadOlderMessages(
  userId: string,
  threadId: string,
  oldestTimestamp: string,
  batchLimit: number
): Promise<LoadMessagesResult> {
  logger.time('loadOlderMessages');
  logger.debug('Loading older messages', { feature: 'ChatService', userId, threadId, oldestTimestamp, batchLimit });
  
  try {
    const result = await retryWithBackoff(async () => {
      const messagesRef = collection(db, 'users', userId, 'chatThreads', threadId, 'messages');
      // Load batchLimit + 1 to check if there are more messages
      const q = query(
        messagesRef, 
        orderBy('timestamp', 'desc'),
        startAt(oldestTimestamp),
        limit(batchLimit + 1)
      );
      const snapshot = await getDocs(q);
      
      const messages: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        const message = doc.data() as ChatMessage;
        // Skip the first message as it's the cursor (oldestTimestamp)
        if (message.timestamp !== oldestTimestamp) {
          messages.push(message);
        }
      });
      
      // If we got more than batchLimit messages (excluding cursor), there are more to load
      const hasMore = messages.length > batchLimit;
      
      // Return only batchLimit messages
      const resultMessages = hasMore ? messages.slice(0, batchLimit) : messages;
      
      return { messages: resultMessages, hasMore };
    }, 3, 500);
    
    logger.timeEnd('loadOlderMessages', { 
      feature: 'ChatService', 
      userId, 
      threadId, 
      count: result.messages.length,
      hasMore: result.hasMore 
    });
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    
    if (isOffline) {
      logger.warn('Failed to load older messages (offline)', {
        feature: 'ChatService',
        userId,
        threadId,
        retries: 3,
      });
    } else {
      logger.error('Error loading older messages', { feature: 'ChatService', userId, threadId, error: err });
    }
    
    return { messages: [], hasMore: false };
  }
}

/**
 * Mark chat as read by resetting unread counter
 * Called when user opens the chat screen
 * 
 * @param userId - User ID
 * @param threadId - Thread ID
 */
export async function markChatAsRead(
  userId: string,
  threadId: string
): Promise<void> {
  logger.debug('Marking chat as read', { feature: 'ChatService', userId, threadId });
  
  try {
    await retryWithBackoff(async () => {
      const threadRef = doc(db, 'users', userId, 'chatThreads', threadId);
      
      await updateDoc(threadRef, {
        unreadCount: 0,
        lastReadAt: new Date().toISOString(),
      });
      
      logger.info('Chat marked as read', { feature: 'ChatService', userId, threadId });
    }, 3, 500);
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    
    if (isOffline) {
      logger.warn('Failed to mark chat as read (offline)', {
        feature: 'ChatService',
        userId,
        threadId,
        retries: 3,
      });
    } else {
      logger.error('Error marking chat as read', { feature: 'ChatService', userId, threadId, error: err });
    }
    
    throw error;
  }
}

