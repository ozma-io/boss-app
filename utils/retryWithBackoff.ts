import { RetryOptions } from '@/types';

interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

function isFirebaseOfflineError(error: Error): boolean {
  return (
    error.message.includes('client is offline') ||
    error.message.includes('Failed to get document') ||
    error.name === 'FirebaseError'
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 500
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Retry] Attempt ${attempt}/${maxRetries}`);
      const result = await operation();
      
      if (attempt > 1) {
        console.log(`[Retry] Success on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      const isOffline = isFirebaseOfflineError(lastError);
      
      console.log(
        `[Retry] Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`,
        isOffline ? '(offline)' : ''
      );
      
      if (attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        console.log(`[Retry] Waiting ${delayMs}ms before next attempt...`);
        await delay(delayMs);
      }
    }
  }
  
  if (lastError) {
    const isOffline = isFirebaseOfflineError(lastError);
    console.warn(
      `[Retry] All ${maxRetries} attempts failed.`,
      isOffline ? 'Client is offline.' : `Error: ${lastError.message}`
    );
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
      console.warn(
        `[Retry] Gracefully handling offline error after ${maxRetries} retries. Returning default value.`
      );
    } else {
      console.error(
        `[Retry] Operation failed after ${maxRetries} retries: ${err.message}`
      );
    }
    
    return defaultValue;
  }
}

