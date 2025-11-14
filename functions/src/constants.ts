/**
 * Configuration Constants for Cloud Functions
 * 
 * Defines constants directly to avoid TypeScript compilation issues.
 */

// ============================================================================
// Facebook Configuration
// ============================================================================
// ⚠️ DUPLICATED in ../../constants/facebook.config.ts - keep both in sync!
export const FACEBOOK_PIXEL_ID = '1170898585142562';
export const FACEBOOK_API_VERSION = 'v24.0';
// ============================================================================
// End of duplicated section
// ============================================================================

// ============================================================================
// Chat Configuration
// ============================================================================

/**
 * Number of hours to include in chat message history
 * Only messages from the last N hours will be sent to OpenAI
 */
export const CHAT_MESSAGE_HISTORY_HOURS = 24;

/**
 * OpenAI model to use for chat completions
 */
export const OPENAI_MODEL = 'gpt-5.1';

/**
 * System prompt for the AI assistant
 * TODO: Replace with actual prompt text
 */
export const CHAT_SYSTEM_PROMPT = 'You are a helpful AI assistant. This is a placeholder prompt that will be replaced with the actual system instructions.';

