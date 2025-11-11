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
 * 
 * Note: With Expo config plugin, Intercom is initialized automatically by native code.
 * This function is here for future customization if needed.
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

  console.log('[Intercom] SDK is initialized via Expo config plugin');
}

/**
 * Get JWT token from backend for secure authentication
 */
async function getJwtFromBackend(userId: string): Promise<string> {
  try {
    console.log('[Intercom] Calling getIntercomJwt for userId:', userId);
    const getIntercomJwt = httpsCallable<void, { token: string }>(functions, 'getIntercomJwt');
    const result = await getIntercomJwt();
    console.log('[Intercom] Got response from backend, token exists:', !!result.data?.token);
    return result.data.token;
  } catch (error) {
    console.error('[Intercom] Failed to get JWT from backend:', error);
    console.error('[Intercom] Backend error details:', JSON.stringify(error, null, 2));
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
    console.log('[Intercom] Starting user registration with params:', {
      userId,
      email,
      name,
      platform: Platform.OS
    });

    // CRITICAL: Logout any existing session to prevent JWT identity mismatch
    // Reference: https://help.intercom.com/en/articles/183-authenticating-users-in-the-messenger-with-json-web-tokens-jwts
    console.log('[Intercom] Step 0: Logging out any existing session...');
    try {
      await IntercomNative.logout();
      console.log('[Intercom] Step 0: Existing session cleared');
    } catch (logoutError) {
      // Ignore logout errors (e.g., if no session exists)
      console.log('[Intercom] Step 0: No existing session to clear');
    }

    console.log('[Intercom] Step 1: Getting JWT from backend...');
    const jwt = await getJwtFromBackend(userId);
    console.log('[Intercom] Step 1: JWT received, length:', jwt?.length);
    
    console.log('[Intercom] Step 2: Setting user JWT...');
    await IntercomNative.setUserJwt(jwt);
    console.log('[Intercom] Step 2: JWT set successfully');
    
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
    
    console.log('[Intercom] Step 3: Logging in with attributes:', JSON.stringify(loginParams, null, 2));
    await IntercomNative.loginUserWithUserAttributes(loginParams);
    console.log('[Intercom] Step 3: Login successful');
    
    console.log('[Intercom] User registered successfully');
  } catch (error) {
    console.error('[Intercom] Failed to register user:', error);
    console.error('[Intercom] Error details:', JSON.stringify(error, null, 2));
    if (error && typeof error === 'object') {
      console.error('[Intercom] Error keys:', Object.keys(error));
      console.error('[Intercom] Error message:', (error as any).message);
      console.error('[Intercom] Error code:', (error as any).code);
      console.error('[Intercom] Error domain:', (error as any).domain);
      
      // Log userInfo details which often contain the actual error description
      if ((error as any).userInfo) {
        console.error('[Intercom] Error userInfo (full):', JSON.stringify((error as any).userInfo, null, 2));
        
        // Standard iOS NSError keys
        if ((error as any).userInfo.NSLocalizedDescription) {
          console.error('[Intercom] NSLocalizedDescription:', (error as any).userInfo.NSLocalizedDescription);
        }
        if ((error as any).userInfo.NSLocalizedRecoverySuggestion) {
          console.error('[Intercom] NSLocalizedRecoverySuggestion:', (error as any).userInfo.NSLocalizedRecoverySuggestion);
        }
        if ((error as any).userInfo.NSLocalizedFailureReason) {
          console.error('[Intercom] NSLocalizedFailureReason:', (error as any).userInfo.NSLocalizedFailureReason);
        }
        if ((error as any).userInfo.NSDebugDescription) {
          console.error('[Intercom] NSDebugDescription:', (error as any).userInfo.NSDebugDescription);
        }
        
        // Underlying error (often contains the real cause)
        if ((error as any).userInfo.NSUnderlyingError) {
          console.error('[Intercom] NSUnderlyingError:', JSON.stringify((error as any).userInfo.NSUnderlyingError, null, 2));
        }
        
        // HTTP response related
        if ((error as any).userInfo.statusCode) {
          console.error('[Intercom] HTTP Status Code:', (error as any).userInfo.statusCode);
        }
        if ((error as any).userInfo.responseBody) {
          console.error('[Intercom] Response Body:', (error as any).userInfo.responseBody);
        }
        if ((error as any).userInfo.body) {
          console.error('[Intercom] Body:', (error as any).userInfo.body);
        }
        
        // Log all keys to see what's available
        console.error('[Intercom] All userInfo keys:', Object.keys((error as any).userInfo));
      }
    }
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

