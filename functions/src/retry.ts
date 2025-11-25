/**
 * Retry Utility for Cloud Functions
 * 
 * Provides exponential backoff retry logic for operations that may fail temporarily.
 */

import { logger } from './logger';

/**
 * Delay execution for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 * 
 * @param operation - Async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param initialDelayMs - Initial delay in milliseconds (default: 1000ms = 1s)
 * @returns Result of successful operation
 * @throws Last error if all retries fail
 * 
 * Delay schedule with default params:
 * - Attempt 1: immediate
 * - Attempt 2: wait 1s (2^0 * 1000ms)
 * - Attempt 3: wait 2s (2^1 * 1000ms)
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info('Retry attempt started', { 
        feature: 'Retry',
        attempt,
        maxRetries,
      });
      
      const result = await operation();
      
      if (attempt > 1) {
        logger.info('Success on retry attempt', { 
          feature: 'Retry',
          attempt,
        });
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      logger.warn('Retry attempt failed', {
        feature: 'Retry',
        attempt,
        maxRetries,
        errorMessage: lastError.message,
      });
      
      // If not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        logger.info('Waiting before next retry attempt', { 
          feature: 'Retry',
          delayMs,
          nextAttempt: attempt + 1,
        });
        await delay(delayMs);
      }
    }
  }
  
  // All retries failed
  if (lastError) {
    logger.error('All retry attempts failed', {
      feature: 'Retry',
      maxRetries,
      errorMessage: lastError.message,
    });
    throw lastError;
  }
  
  throw new Error('Retry failed with unknown error');
}

