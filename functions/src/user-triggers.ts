/**
 * User Document Triggers
 * 
 * Handles Firestore triggers for user document lifecycle events
 */

import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { CHAT_WELCOME_MESSAGE } from './constants';
import { logger } from './logger';
import type { ContentItem, FirestoreChatMessage } from './types/chat.types';

/**
 * DISABLED: Firestore Trigger for chat initialization
 * 
 * ⚠️ THIS FUNCTION IS DISABLED to prevent race conditions
 * 
 * Chat creation is now handled synchronously at user creation time:
 * - Web-funnel: web-funnels/app/api/firebase/create-user/route.ts → createChatWithWelcomeMessage()
 * - App registration: boss-app/services/user.service.ts → createChatWithWelcomeMessage()
 * 
 * This eliminates the race condition where users could open the chat screen
 * before the Cloud Function completed, causing fallback errors.
 * 
 * DEPLOYMENT: Comment out the export in functions/src/index.ts to fully disable
 */
const onUserCreated_DISABLED = onDocumentCreated(
  {
    document: 'users/{userId}',
    region: 'us-central1',
  },
  async (event) => {
    const userId = event.params.userId;
    
    logger.info('User created, initializing chat with welcome message', { userId });
    
    const db = admin.firestore();
    const threadId = 'main'; // Single thread per user for MVP
    
    try {
      // Create the main chat thread
      const threadRef = db.collection('users').doc(userId)
        .collection('chatThreads').doc(threadId);
      
      const now = new Date().toISOString();
      
      // Welcome message content
      const welcomeContent: ContentItem[] = [
        {
          type: 'text',
          text: CHAT_WELCOME_MESSAGE,
        },
      ];
      
      // Create welcome message
      const welcomeMessage: FirestoreChatMessage = {
        role: 'assistant',
        content: welcomeContent,
        timestamp: now,
      };
      
      // Add message to collection first
      const messageRef = await threadRef.collection('messages').add(welcomeMessage);
      
      // Then create thread document with metadata
      await threadRef.set({
        createdAt: now,
        updatedAt: now,
        messageCount: 1,
        assistantIsTyping: false,
        unreadCount: 0, // Let the onChatMessageCreated trigger increment it to 1
        lastReadAt: null,
        lastMessageAt: now,
        lastMessageRole: 'assistant',
      });
      
      logger.info('Chat thread and welcome message created successfully', {
        userId,
        threadId,
        messageId: messageRef.id,
      });
      
      // NOTE: Boss creation is handled explicitly elsewhere:
      // - Web-funnel: creates boss with onboarding data when user submits email
      // - App registration: ensureUserProfileExists() creates default boss for new users
      // This prevents race conditions between trigger and explicit creation
      
    } catch (error) {
      logger.error('Failed to initialize new user data (chat)', {
        userId,
        error,
      });
      // Don't throw - we don't want user creation to fail if chat/boss setup fails
    }
  }
);

