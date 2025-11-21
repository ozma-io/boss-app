import { functions } from '@/constants/firebase.config';
import { logger } from '@/services/logger.service';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';

let IntercomNative: any = null;

if (Platform.OS !== 'web') {
  try {
    IntercomNative = require('@intercom/intercom-react-native').default;
  } catch (error) {
    logger.warn('@intercom/intercom-react-native not available', { feature: 'Intercom', error });
  }
}

// Track if user is registered to avoid duplicate registrations
let isUserRegistered = false;
let registeredUserId: string | null = null;

/**
 * Initialize Intercom SDK
 * Should be called once at app startup
 * Only works on iOS and Android
 * 
 * Note: With Expo config plugin, Intercom is initialized automatically by native code.
 * This function is here for future customization if needed.
 */
export async function initializeIntercom(): Promise<void> {
  if (Platform.OS === 'web') {
    logger.info('Skipping on web', { feature: 'Intercom' });
    return;
  }

  if (!IntercomNative) {
    logger.warn('SDK not available, skipping initialization', { feature: 'Intercom' });
    return;
  }

  logger.info('SDK is initialized via Expo config plugin', { feature: 'Intercom' });
}

/**
 * Get JWT token from backend for secure authentication
 */
async function getJwtFromBackend(userId: string): Promise<string> {
  try {
    logger.info('Calling getIntercomJwt', { feature: 'Intercom', userId });
    const getIntercomJwt = httpsCallable<void, { token: string }>(functions, 'getIntercomJwt');
    const result = await getIntercomJwt();
    logger.info('Got response from backend', { feature: 'Intercom', tokenExists: !!result.data?.token });
    return result.data.token;
  } catch (error) {
    logger.error('Failed to get JWT from backend', { feature: 'Intercom', error, errorDetails: JSON.stringify(error, null, 2) });
    throw new Error('Failed to get Intercom JWT');
  }
}

/**
 * Register user in Intercom with JWT authentication
 * This should be called after successful Firebase authentication
 * Only works on iOS and Android
 * 
 * IMPORTANT: We intentionally send email to Intercom for support functionality.
 * Intercom uses email to send unread conversation messages to users via email.
 * This is a core support feature and justified use of PII.
 */
export async function registerIntercomUser(
  userId: string,
  email: string,
  name?: string
): Promise<void> {
  if (Platform.OS === 'web' || !IntercomNative) {
    logger.info('Skipping registration (web or SDK not available)', { feature: 'Intercom' });
    return;
  }

  try {
    logger.info('Starting user registration', { feature: 'Intercom', userId, email, name, platform: Platform.OS });

    // CRITICAL: Logout any existing session to prevent JWT identity mismatch
    // Reference: https://help.intercom.com/en/articles/183-authenticating-users-in-the-messenger-with-json-web-tokens-jwts
    logger.info('Step 0: Logging out any existing session', { feature: 'Intercom' });
    try {
      await IntercomNative.logout();
      logger.info('Step 0: Existing session cleared', { feature: 'Intercom' });
    } catch (logoutError) {
      // Ignore logout errors (e.g., if no session exists)
      logger.info('Step 0: No existing session to clear', { feature: 'Intercom' });
    }

    logger.info('Step 1: Getting JWT from backend', { feature: 'Intercom' });
    const jwt = await getJwtFromBackend(userId);
    logger.info('Step 1: JWT received', { feature: 'Intercom', jwtLength: jwt?.length });
    
    logger.info('Step 2: Setting user JWT', { feature: 'Intercom' });
    await IntercomNative.setUserJwt(jwt);
    logger.info('Step 2: JWT set successfully', { feature: 'Intercom' });
    
    // Use simple format as per official documentation
    // https://developers.intercom.com/installing-intercom/react-native/installation
    const loginParams: any = {
      userId: userId,
      email: email,
    };
    
    // Only add name if it's provided (optional field)
    if (name) {
      loginParams.name = name;
    }
    
    logger.info('Step 3: Logging in with attributes', { feature: 'Intercom', loginParams });
    await IntercomNative.loginUserWithUserAttributes(loginParams);
    logger.info('Step 3: Login successful', { feature: 'Intercom' });
    
    logger.info('User registered successfully', { feature: 'Intercom' });
  } catch (error) {
    const err = error as any;
    logger.error('Failed to register user', { 
      feature: 'Intercom',
      error,
      errorKeys: err && typeof err === 'object' ? Object.keys(err) : [],
      errorMessage: err?.message,
      errorCode: err?.code,
      errorDomain: err?.domain,
      userInfo: err?.userInfo ? {
        full: JSON.stringify(err.userInfo, null, 2),
        NSLocalizedDescription: err.userInfo.NSLocalizedDescription,
        NSLocalizedRecoverySuggestion: err.userInfo.NSLocalizedRecoverySuggestion,
        NSLocalizedFailureReason: err.userInfo.NSLocalizedFailureReason,
        NSDebugDescription: err.userInfo.NSDebugDescription,
        NSUnderlyingError: err.userInfo.NSUnderlyingError ? JSON.stringify(err.userInfo.NSUnderlyingError, null, 2) : undefined,
        statusCode: err.userInfo.statusCode,
        responseBody: err.userInfo.responseBody,
        body: err.userInfo.body,
        allKeys: Object.keys(err.userInfo)
      } : undefined
    });
    // Don't throw - allow app to continue without Intercom
  }
}

/**
 * Ensure user is registered in Intercom before showing messenger
 * This is called lazily when user opens Support screen
 * @param userId - Firebase user ID
 * @param email - User email
 * @param name - User name (optional)
 */
async function ensureUserRegistered(userId: string, email: string, name?: string): Promise<void> {
  if (isUserRegistered && registeredUserId === userId) {
    logger.info('User already registered, skipping', { feature: 'Intercom', userId });
    return;
  }

  logger.info('Registering user lazily before showing messenger', { feature: 'Intercom', userId });
  await registerIntercomUser(userId, email, name);
  isUserRegistered = true;
  registeredUserId = userId;
}

/**
 * Show Intercom messenger
 * Call this when user opens Support screen
 * Only works on iOS and Android
 * 
 * IMPORTANT: This function registers the user lazily (on first call) to avoid
 * background timeout issues. Registration happens when app is guaranteed to be
 * in foreground (user clicked Support button).
 * 
 * @param userId - Firebase user ID (required for lazy registration)
 * @param email - User email (required for lazy registration)
 * @param name - User name (optional)
 */
export async function showIntercomMessenger(userId: string, email: string, name?: string): Promise<void> {
  if (Platform.OS === 'web' || !IntercomNative) {
    logger.info('Skipping messenger (web or SDK not available)', { feature: 'Intercom' });
    return;
  }

  try {
    // Register user lazily if not already registered
    await ensureUserRegistered(userId, email, name);
    
    await IntercomNative.present();
    logger.info('Messenger opened', { feature: 'Intercom' });
  } catch (error) {
    logger.error('Failed to open messenger', { feature: 'Intercom', error });
    throw error;
  }
}

/**
 * Logout user from Intercom
 * Should be called when user signs out
 * Only works on iOS and Android
 */
export async function logoutIntercomUser(): Promise<void> {
  if (Platform.OS === 'web' || !IntercomNative) {
    logger.info('Skipping logout (web or SDK not available)', { feature: 'Intercom' });
    return;
  }

  try {
    await IntercomNative.logout();
    // Reset registration state
    isUserRegistered = false;
    registeredUserId = null;
    logger.info('User logged out', { feature: 'Intercom' });
  } catch (error) {
    logger.error('Failed to logout', { feature: 'Intercom', error });
    // Don't throw - allow app to continue
  }
}

