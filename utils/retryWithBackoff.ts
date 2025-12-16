import { logger } from '@/services/logger.service';
import { isFirebaseOfflineError } from '@/utils/firebaseErrors';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is a permission-denied error
 * These typically indicate auth token propagation issues
 */
function isPermissionDeniedError(error: Error & { code?: string }): boolean {
  return (
    error.code === 'permission-denied' ||
    error.code === 'PERMISSION_DENIED' ||
    error.message.includes('permission-denied') ||
    error.message.includes('Missing or insufficient permissions')
  );
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
      const err = lastError as Error & { code?: string };
      const isOffline = isFirebaseOfflineError(lastError);
      const isPermissionDenied = isPermissionDeniedError(err);
      const attemptDuration = Date.now() - startTime;
      
      logger.debug('Retry attempt failed', {
        feature: 'Retry',
        attempt,
        maxRetries,
        duration: attemptDuration,
        isOffline,
        isPermissionDenied,
        errorMessage: lastError.message,
        errorCode: err.code,
      });
      
      if (attempt < maxRetries) {
        // Use longer delays for permission-denied errors (auth token propagation issue)
        // Regular errors: 500ms, 1000ms, 2000ms
        // Permission errors: 1000ms, 2000ms, 4000ms
        const baseDelay = isPermissionDenied ? initialDelayMs * 2 : initialDelayMs;
        const delayMs = baseDelay * Math.pow(2, attempt - 1);
        
        logger.debug('Waiting before next retry attempt', { 
          feature: 'Retry', 
          delayMs,
          isPermissionDenied,
          reason: isPermissionDenied ? 'auth token propagation' : 'standard retry'
        });
        await delay(delayMs);
      }
    }
  }
  
  if (lastError) {
    const err = lastError as Error & { code?: string };
    const isOffline = isFirebaseOfflineError(lastError);
    const isPermissionDenied = isPermissionDeniedError(err);
    const totalDuration = Date.now() - startTime;
    logger.warn('All retry attempts failed', {
      feature: 'Retry',
      maxRetries,
      totalDuration,
      isOffline,
      isPermissionDenied,
      errorMessage: lastError.message,
      errorCode: err.code,
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

