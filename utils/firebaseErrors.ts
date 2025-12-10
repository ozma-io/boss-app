/**
 * Firebase Error Classification Utilities
 * 
 * Provides consistent error classification across all services to distinguish
 * between offline/network errors and permission/auth errors.
 */

/**
 * Check if error is related to offline state or network issues
 * 
 * IMPORTANT: Uses error.code instead of error.name to avoid masking permission-denied errors.
 * Previous implementation (error.name === 'FirebaseError') was too broad and incorrectly 
 * classified permission-denied as offline, hiding real auth/token issues.
 * 
 * @param error - Error object from Firebase operation
 * @returns true if error is due to offline/network issues, false otherwise
 * 
 * @example
 * ```typescript
 * try {
 *   await getDoc(docRef);
 * } catch (error) {
 *   if (isFirebaseOfflineError(error)) {
 *     // Handle offline gracefully
 *   } else {
 *     // Handle other errors (auth, permission, etc)
 *   }
 * }
 * ```
 * 
 * @see Sentry Issue #7023631375 - permission-denied was masked as offline
 */
export function isFirebaseOfflineError(error: Error & { code?: string }): boolean {
  return (
    error.code === 'unavailable' ||
    error.code === 'failed-precondition' ||
    error.message.includes('client is offline')
  );
}

/**
 * Check if error is an expected Firebase error that should be logged as warning instead of error
 * 
 * These errors are typically transient issues (timeouts, rate limiting, temporary unavailability)
 * that don't indicate bugs in our code and shouldn't create noise in Sentry.
 * 
 * @param error - Error object from Firebase operation
 * @returns true if error is expected and should be logged as warning, false otherwise
 * 
 * @example
 * ```typescript
 * try {
 *   await httpsCallable(functions, 'generateChatResponse')();
 * } catch (error) {
 *   if (isExpectedFirebaseError(error)) {
 *     logger.warn('Expected error', { error });
 *   } else {
 *     logger.error('Unexpected error', { error });
 *   }
 * }
 * ```
 */
export function isExpectedFirebaseError(error: Error & { code?: string }): boolean {
  return (
    error.code === 'functions/deadline-exceeded' ||    // Cloud Function timeout
    error.code === 'functions/unavailable' ||          // Cloud Function temporarily unavailable
    error.code === 'functions/resource-exhausted'      // Rate limiting
  );
}
