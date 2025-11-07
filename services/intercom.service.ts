import { functions } from '@/constants/firebase.config';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';

let IntercomNative: any = null;

if (Platform.OS !== 'web') {
  IntercomNative = require('@intercom/intercom-react-native').default;
}

/**
 * Initialize Intercom SDK
 * Should be called once at app startup
 * Only works on iOS and Android
 */
export async function initializeIntercom(): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('ℹ️ Intercom is only available on iOS and Android');
    return;
  }

  try {
    await IntercomNative.setInAppMessagesVisibility('VISIBLE');
    console.log('✅ Intercom Native initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Intercom:', error);
    throw new Error('Failed to initialize Intercom');
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
  if (Platform.OS === 'web') {
    console.log('ℹ️ Intercom is only available on iOS and Android');
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
    
    console.log('✅ User registered in Intercom with JWT authentication');
  } catch (error) {
    console.error('Failed to register user in Intercom:', error);
    throw new Error('Failed to register user in Intercom');
  }
}

/**
 * Show Intercom messenger
 * Call this when user opens Support screen
 * Only works on iOS and Android
 */
export async function showIntercomMessenger(): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('ℹ️ Intercom is only available on iOS and Android');
    return;
  }

  try {
    await IntercomNative.present();
    console.log('✅ Intercom messenger opened');
  } catch (error) {
    console.error('Failed to open Intercom messenger:', error);
    throw new Error('Failed to open Intercom messenger');
  }
}

/**
 * Logout user from Intercom
 * Should be called when user signs out
 * Only works on iOS and Android
 */
export async function logoutIntercomUser(): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('ℹ️ Intercom is only available on iOS and Android');
    return;
  }

  try {
    await IntercomNative.logout();
    console.log('✅ User logged out from Intercom');
  } catch (error) {
    console.error('Failed to logout from Intercom:', error);
    throw new Error('Failed to logout from Intercom');
  }
}

