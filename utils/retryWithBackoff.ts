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
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const attemptStart = Date.now();
      console.log(`🔄 [Retry] >>> Attempt ${attempt}/${maxRetries} started at ${new Date().toISOString()}`);
      const result = await operation();
      const attemptDuration = Date.now() - attemptStart;
      
      if (attempt > 1) {
        console.log(`🔄 [Retry] <<< Success on attempt ${attempt} (took ${attemptDuration}ms)`);
      } else {
        console.log(`🔄 [Retry] <<< Success on first attempt (took ${attemptDuration}ms)`);
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      const isOffline = isFirebaseOfflineError(lastError);
      const attemptDuration = Date.now() - startTime;
      
      console.log(
        `🔄 [Retry] !!! Attempt ${attempt}/${maxRetries} failed after ${attemptDuration}ms: ${lastError.message}`,
        isOffline ? '(offline)' : ''
      );
      
      if (attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        console.log(`🔄 [Retry] ⏱️  Waiting ${delayMs}ms before next attempt...`);
        await delay(delayMs);
      }
    }
  }
  
  if (lastError) {
    const isOffline = isFirebaseOfflineError(lastError);
    const totalDuration = Date.now() - startTime;
    console.warn(
      `🔄 [Retry] ❌ All ${maxRetries} attempts failed after ${totalDuration}ms.`,
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

