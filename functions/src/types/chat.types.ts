/**
 * Type definitions for Chat Cloud Functions
 * 
 * Provides type safety for OpenAI integration and Cloud Function interfaces
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat';

/**
 * Message role type
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Content item type
 */
export type ContentType = 'text' | 'image_url';

/**
 * Content item structure (multimodal format)
 */
export interface ContentItem {
  type: ContentType;
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

/**
 * Firestore chat message structure
 */
export interface FirestoreChatMessage {
  role: MessageRole;
  content: ContentItem[];
  timestamp: string;
}

/**
 * Request data for generateChatResponse callable function
 */
export interface GenerateChatResponseRequest {
  userId: string;
  threadId: string;
  messageId: string;
  sessionId?: string; // Optional app session ID for LangFuse grouping
  currentDateTimeUTC?: string; // Current date/time in UTC from user's device
  currentDateTimeLocal?: string; // Current date/time with timezone offset from user's device
  userTimezone?: string; // User's timezone name (e.g., "Europe/Moscow")
}

/**
 * Response data from generateChatResponse callable function
 */
export interface GenerateChatResponseResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Re-export OpenAI types for convenience
 */
export type { ChatCompletionMessageParam };

