/**
 * Type definitions for Chat Cloud Functions
 * 
 * Imports types from shared schemas (single source of truth)
 * and provides Cloud Function-specific interfaces
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import type {
  MessageRole,
  ContentType,
  ContentItemSchema,
  ChatMessageSchema,
} from '../../../firestore/schemas';

/**
 * Re-export types from schemas for convenience
 */
export type { MessageRole, ContentType };

/**
 * Content item structure (alias to schema)
 */
export type ContentItem = ContentItemSchema;

/**
 * Firestore chat message structure (alias to schema)
 */
export type FirestoreChatMessage = ChatMessageSchema;

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
