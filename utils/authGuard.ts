/**
 * Auth Guard Utility
 * 
 * Prevents permission-denied errors due to Firebase Auth/Firestore race conditions.
 * 
 * PROBLEM:
 * When user logs in, onAuthStateChanged fires with user object, but the Firebase Auth
 * token may not be fully valid yet for Firestore Security Rules. This causes the first
 * Firestore request to fail with "permission-denied" error.
 * 
 * SOLUTION:
 * Call ensureAuthReady() before critical Firestore operations (especially first requests
 * after login). It validates auth state and forces token refresh to guarantee validity.
 * 
 * USAGE:
 * Add to functions that make the FIRST Firestore request in a user flow:
 * - ensureUserProfileExists() - first request after login
 * - getFirstBoss() - first request when opening boss screen
 * - getOrCreateThread() - first request when opening chat
 * 
 * NOT NEEDED:
 * - onSnapshot() subscriptions - Firebase SDK handles token refresh automatically
 * - Subsequent requests in same flow - token is already validated
 * 
 * @see Sentry Issue #7023631375 - Original bug report
 */

import { logger } from '@/services/logger.service';

/**
 * Ensures Firebase Auth is fully ready and token is valid before making Firestore requests
 * 
 * This prevents permission-denied errors due to race conditions where:
 * - onAuthStateChanged fires with user object
 * - But auth token is not yet fully valid for Firestore security rules
 * 
 * @param userId - Expected user ID to validate against current auth state
 * @throws Error if auth state is invalid or token cannot be obtained
 */
export async function ensureAuthReady(userId: string): Promise<void> {
  const { auth } = await import('@/constants/firebase.config');
  const currentUser = auth.currentUser;
  
  logger.debug('Auth guard check started', {
    feature: 'authGuard',
    expectedUserId: userId,
    hasCurrentUser: !!currentUser,
  });
  
  if (!currentUser) {
    const error = new Error('No authenticated user found');
    logger.error('Auth guard failed: no current user', {
      feature: 'authGuard',
      expectedUserId: userId,
    });
    throw error;
  }
  
  if (currentUser.uid !== userId) {
    const error = new Error(`Auth user ID mismatch: expected ${userId}, got ${currentUser.uid}`);
    logger.error('Auth guard failed: user ID mismatch', {
      feature: 'authGuard',
      expectedUserId: userId,
      currentUserId: currentUser.uid,
    });
    throw error;
  }
  
  // Force token refresh to ensure it's valid and not expired
  const tokenStartTime = Date.now();
  try {
    const token = await currentUser.getIdToken(true);
    const tokenDuration = Date.now() - tokenStartTime;
    
    logger.debug('Auth token validated successfully', {
      feature: 'authGuard',
      userId,
      tokenDuration,
      tokenLength: token.length,
    });
    
    // Add small delay to allow token to propagate to Firestore backend
    // This prevents permission-denied errors on some devices (especially Android)
    // where token validation succeeds but Firestore backend hasn't received it yet
    const TOKEN_PROPAGATION_DELAY_MS = 200;
    await new Promise(resolve => setTimeout(resolve, TOKEN_PROPAGATION_DELAY_MS));
    
    logger.debug('Token propagation delay completed', {
      feature: 'authGuard',
      userId,
      delayMs: TOKEN_PROPAGATION_DELAY_MS,
    });
  } catch (tokenError) {
    logger.error('Auth guard failed: token error', {
      feature: 'authGuard',
      userId,
      error: tokenError,
    });
    throw tokenError;
  }
}
