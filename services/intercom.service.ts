import { functions } from '@/constants/firebase.config';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';

let IntercomNative: any = null;

if (Platform.OS !== 'web') {
  try {
    IntercomNative = require('@intercom/intercom-react-native').default;
  } catch (error) {
    console.warn('[Intercom] @intercom/intercom-react-native not available:', error);
  }
}

/**
 * Initialize Intercom SDK
 * Should be called once at app startup
 * Only works on iOS and Android
 */
export async function initializeIntercom(): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[Intercom] Skipping on web');
    return;
  }

  if (!IntercomNative) {
    console.warn('[Intercom] SDK not available, skipping initialization');
    return;
  }

  try {
    await IntercomNative.setInAppMessagesVisibility('VISIBLE');
    console.log('[Intercom] Initialized successfully');
  } catch (error) {
    console.error('[Intercom] Failed to initialize:', error);
    // Don't throw - allow app to continue without Intercom
  }
}

/**
 * Get JWT token from backend for secure authentication
 */
async function getJwtFromBackend(userId: string): Promise<string> {
  try {
    const getIntercomJwt = httpsCallable<void, { token: string }>(functions, 'getIntercomJwt');
    const result = await getIntercomJwt();
    return result.data.token;
  } catch (error) {
    console.error('Failed to get Intercom JWT from backend:', error);
    throw new Error('Failed to get Intercom JWT');
  }
}

/**
 * Register user in Intercom with JWT authentication
 * This should be called after successful Firebase authentication
 * Only works on iOS and Android
 */
export async function registerIntercomUser(
  userId: string,
  email: string,
  name?: string
): Promise<void> {
  if (Platform.OS === 'web' || !IntercomNative) {
    console.log('[Intercom] Skipping registration (web or SDK not available)');
    return;
  }

  try {
    const jwt = await getJwtFromBackend(userId);
    
    await IntercomNative.setUserJwt(jwt);
    
    await IntercomNative.loginUserWithUserAttributes({
      userId: userId,
      email: email,
      name: name,
      customAttributes: {
        signedUpAt: new Date().toISOString(),
        platform: Platform.OS,
      }
    });
    
    console.log('[Intercom] User registered successfully');
  } catch (error) {
    console.error('[Intercom] Failed to register user:', error);
    // Don't throw - allow app to continue without Intercom
  }
}

/**
 * Show Intercom messenger
 * Call this when user opens Support screen
 * Only works on iOS and Android
 */
export async function showIntercomMessenger(): Promise<void> {
  if (Platform.OS === 'web' || !IntercomNative) {
    console.log('[Intercom] Skipping messenger (web or SDK not available)');
    return;
  }

  try {
    await IntercomNative.present();
    console.log('[Intercom] Messenger opened');
  } catch (error) {
    console.error('[Intercom] Failed to open messenger:', error);
    // Don't throw - just log the error
  }
}

/**
 * Logout user from Intercom
 * Should be called when user signs out
 * Only works on iOS and Android
 */
export async function logoutIntercomUser(): Promise<void> {
  if (Platform.OS === 'web' || !IntercomNative) {
    console.log('[Intercom] Skipping logout (web or SDK not available)');
    return;
  }

  try {
    await IntercomNative.logout();
    console.log('[Intercom] User logged out');
  } catch (error) {
    console.error('[Intercom] Failed to logout:', error);
    // Don't throw - allow app to continue
  }
}

