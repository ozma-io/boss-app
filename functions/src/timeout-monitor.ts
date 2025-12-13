/**
 * Timeout Monitor for Cloud Functions
 * 
 * Starts a background timer that warns in Sentry before function times out.
 * Helps debug timeout issues by capturing state before function is killed.
 */

import { Sentry } from './sentry';

/**
 * Create timeout monitor that warns before function times out
 * 
 * Starts a background timer that automatically sends warning to Sentry
 * 10 seconds before the function timeout. This works even if code is stuck
 * in external SDK calls (like OpenAI API).
 * 
 * @param timeoutSeconds - Total timeout configured for the function
 * @returns Monitor with cancel() method to stop the timer on success
 * 
 * @example
 * const monitor = createTimeoutMonitor(120);
 * try {
 *   const result = await openai.chat.completions.create(...);
 *   monitor.cancel(); // Success - stop the warning timer
 * } catch (error) {
 *   // Timer will fire if we're still running after 110 seconds
 * }
 */
export function createTimeoutMonitor(timeoutSeconds: number): { 
  cancel: () => void;
  check: (operationName: string) => Promise<void>;
} {
  const warningThreshold = (timeoutSeconds - 10) * 1000; // Convert to milliseconds
  const startTime = Date.now();
  let lastCheckpoint = 'Function started';
  let cancelled = false;
  
  // Start background timer that fires 10 seconds before timeout
  const timer = setTimeout(() => {
    if (cancelled) return;
    
    const elapsed = (Date.now() - startTime) / 1000;
    
    Sentry.captureMessage(
      'Cloud Function approaching timeout - about to be killed',
      {
        level: 'error', // Changed from 'warning' to 'error' since this is critical
        extra: {
          elapsedSeconds: Math.round(elapsed * 10) / 10,
          timeoutSeconds,
          remainingSeconds: Math.round((timeoutSeconds - elapsed) * 10) / 10,
          lastCheckpoint,
          message: 'Function will be killed in ~10 seconds. Check if OpenAI or other external API is hanging.',
        },
      }
    );
  }, warningThreshold);
  
  return {
    cancel: (): void => {
      cancelled = true;
      clearTimeout(timer);
    },
    
    check: async (operationName: string): Promise<void> => {
      lastCheckpoint = operationName;
      
      // Optional: also check synchronously at checkpoints for early warning
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed >= (timeoutSeconds - 10)) {
        Sentry.captureMessage(
          `Function checkpoint after timeout threshold: ${operationName}`,
          {
            level: 'warning',
            extra: {
              elapsedSeconds: Math.round(elapsed * 10) / 10,
              timeoutSeconds,
              remainingSeconds: Math.round((timeoutSeconds - elapsed) * 10) / 10,
              operationName,
            },
          }
        );
      }
    },
  };
}

