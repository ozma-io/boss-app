/**
 * Chat Schema (OpenAI-compatible format)
 * 
 * Path: /users/{userId}/chatThreads/{threadId}
 * Path: /users/{userId}/chatThreads/{threadId}/messages/{messageId}
 * 
 * Represents AI chat conversations with multimodal content support.
 * 
 * ## Collections:
 * 
 * 1. **ChatThread** - Conversation session
 *    - Single thread per user for MVP
 *    - Auto-created on first message
 *    - Tracks message count and timestamps
 * 
 * 2. **ChatMessage** - Individual messages in a thread
 *    - OpenAI-compatible format
 *    - Multimodal content (text, images)
 *    - Roles: user, assistant, system
 * 
 * ## Content Format:
 * 
 * Messages use an array of content items to support multimodal interactions:
 * - Text: { type: 'text', text: 'message content' }
 * - Image: { type: 'image_url', image_url: { url: 'https://...' } }
 * 
 * This format is compatible with OpenAI Chat Completion API and can be sent directly.
 */

export interface ChatThreadSchema {
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp - updated on each new message
  messageCount: number; // Total number of messages in thread
  assistantIsTyping: boolean; // Whether AI is currently generating a response
  currentGenerationId?: string; // UUID of current response generation (for cancellation)
  
  // Unread message tracking
  unreadCount: number; // Number of unread messages from assistant
  lastReadAt: string | null; // ISO 8601 timestamp of last time user opened chat
  lastMessageAt: string | null; // ISO 8601 timestamp of last message
  lastMessageRole: MessageRole | null; // Role of last message sender
}

export type MessageRole = 'user' | 'assistant' | 'system';
export type ContentType = 'text' | 'image_url';

export interface ContentItemSchema {
  type: ContentType;
  
  // For type: 'text'
  text?: string;
  
  // For type: 'image_url'
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high'; // Image analysis detail level
  };
}

export interface ChatMessageSchema {
  role: MessageRole; // Who sent the message
  content: ContentItemSchema[]; // Array of content items (multimodal)
  timestamp: string; // ISO 8601 timestamp
}

/**
 * Default values for new thread
 */
export const ChatThreadDefaults: Partial<ChatThreadSchema> = {
  messageCount: 0,
  assistantIsTyping: false,
  unreadCount: 0,
  lastReadAt: null,
  lastMessageAt: null,
  lastMessageRole: null,
};

/**
 * Helper function to create text-only content
 */
export function createTextContent(text: string): ContentItemSchema[] {
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
export function extractTextFromContent(content: ContentItemSchema[]): string {
  return content
    .filter((item) => item.type === 'text' && item.text)
    .map((item) => item.text)
    .join(' ');
}

/**
 * Version tracking
 * Increment this when making breaking schema changes
 * 
 * Version 1: Initial chat schema with OpenAI-compatible multimodal format
 */
export const CHAT_SCHEMA_VERSION = 1;

