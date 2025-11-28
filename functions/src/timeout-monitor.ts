/**
 * Timeout Monitor for Cloud Functions
 * 
 * Sends warning to Sentry when function approaches timeout threshold.
 * Helps debug timeout issues by identifying which operation caused delay.
 */

import { Sentry } from './sentry';

/**
 * Create timeout monitor that warns before function times out
 * 
 * @param timeoutSeconds - Total timeout configured for the function
 * @returns Monitor with check() method to call before expensive operations
 * 
 * @example
 * const monitor = createTimeoutMonitor(120);
 * await monitor.check('Before OpenAI call');
 * const result = await openai.chat.completions.create(...);
 */
export function createTimeoutMonitor(timeoutSeconds: number): { check: (operationName: string) => Promise<void> } {
  const warningThreshold = timeoutSeconds - 10; // Warn 10 seconds before timeout
  const startTime = Date.now();
  
  return {
    check: async (operationName: string): Promise<void> => {
      const elapsed = (Date.now() - startTime) / 1000;
      
      if (elapsed >= warningThreshold) {
        Sentry.captureMessage(
          `Function approaching timeout: ${operationName}`,
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
    }
  };
}

