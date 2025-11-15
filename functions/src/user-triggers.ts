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
 * Firestore Trigger: Create welcome message when new user is created
 * 
 * Triggers when a new user document is created and:
 * 1. Creates the main chat thread
 * 2. Adds a welcome message from the assistant
 * 
 * This ensures every new user has a welcome message waiting for them
 * even before they open the chat for the first time.
 */
export const onUserCreated = onDocumentCreated(
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
        unreadCount: 1, // Mark as unread so user sees notification badge
        lastReadAt: null,
        lastMessageAt: now,
        lastMessageRole: 'assistant',
      });
      
      logger.info('Chat thread and welcome message created successfully', {
        userId,
        threadId,
        messageId: messageRef.id,
      });
    } catch (error) {
      logger.error('Failed to create welcome message for new user', {
        userId,
        error,
      });
      // Don't throw - we don't want user creation to fail if chat setup fails
    }
  }
);

