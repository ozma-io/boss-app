/**
 * Shared Logger Utility for Cloud Functions
 * 
 * Provides consistent logging across all Cloud Functions with automatic
 * Sentry integration for errors and warnings.
 */

import { Sentry } from './sentry';

/**
 * Logger interface for Cloud Functions
 * Maintains console output for Firebase Console logs while also sending
 * errors and warnings to Sentry for centralized monitoring
 */
export const logger = {
  /**
   * Log informational messages
   * Only sends to console, not to Sentry
   */
  info: (message: string, context: Record<string, unknown>) => {
    console.log(`[INFO] ${message}`, JSON.stringify(context));
  },

  /**
   * Log error messages
   * Sends to both console and Sentry with full context
   */
  error: (message: string, context: Record<string, unknown>) => {
    console.error(`[ERROR] ${message}`, JSON.stringify(context));
    
    // Send to Sentry with context
    Sentry.captureException(new Error(message), {
      level: 'error',
      extra: context,
    });
  },

  /**
   * Log warning messages
   * Sends to both console and Sentry with warning level
   */
  warn: (message: string, context: Record<string, unknown>) => {
    console.warn(`[WARN] ${message}`, JSON.stringify(context));
    
    // Send to Sentry as warning
    Sentry.captureMessage(message, {
      level: 'warning',
      extra: context,
    });
  },

  /**
   * Log debug messages
   * Only sends to console, not to Sentry
   */
  debug: (message: string, context: Record<string, unknown>) => {
    console.log(`[DEBUG] ${message}`, JSON.stringify(context));
  },
};

