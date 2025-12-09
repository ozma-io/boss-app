import { logger } from '@/services/logger.service';
import { isFirebaseOfflineError } from '@/utils/firebaseErrors';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 500
): Promise<T> {
  let lastError: Error | null = null;
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const attemptStart = Date.now();
      logger.debug('Retry attempt started', { feature: 'Retry', attempt, maxRetries });
      const result = await operation();
      const attemptDuration = Date.now() - attemptStart;
      
      if (attempt > 1) {
        logger.info('Success on retry attempt', { feature: 'Retry', attempt, duration: attemptDuration });
      } else {
        logger.debug('Success on first attempt', { feature: 'Retry', duration: attemptDuration });
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      const isOffline = isFirebaseOfflineError(lastError);
      const attemptDuration = Date.now() - startTime;
      
      logger.debug('Retry attempt failed', {
        feature: 'Retry',
        attempt,
        maxRetries,
        duration: attemptDuration,
        isOffline,
        errorMessage: lastError.message,
      });
      
      if (attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        logger.debug('Waiting before next retry attempt', { feature: 'Retry', delayMs });
        await delay(delayMs);
      }
    }
  }
  
  if (lastError) {
    const isOffline = isFirebaseOfflineError(lastError);
    const totalDuration = Date.now() - startTime;
    logger.warn('All retry attempts failed', {
      feature: 'Retry',
      maxRetries,
      totalDuration,
      isOffline,
      errorMessage: lastError.message,
    });
    throw lastError;
  }
  
  throw new Error('Retry failed with unknown error');
}

export async function retryWithBackoffGraceful<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 500,
  defaultValue: T
): Promise<T> {
  try {
    return await retryWithBackoff(operation, maxRetries, initialDelayMs);
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    
    if (isOffline) {
      logger.warn('Gracefully handling offline error, returning default value', {
        feature: 'Retry',
        maxRetries,
        errorMessage: err.message,
      });
    } else {
      logger.error('Operation failed after retries', {
        feature: 'Retry',
        maxRetries,
        error: err,
      });
    }
    
    return defaultValue;
  }
}

