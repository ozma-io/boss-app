import { auth } from '@/constants/firebase.config';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '@/constants/google.config';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { sendFirstLoginEvents } from '@/services/facebook.service';
import { ensureUserProfileExists } from '@/services/user.service';
import { LoginMethod, User } from '@/types';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  User as FirebaseUser,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInWithCustomToken,
  signInWithEmailLink
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import { logger } from './logger.service';

WebBrowser.maybeCompleteAuthSession();

/**
 * Extract detailed error information from Firebase errors for logging
 * 
 * Firebase Auth errors have the following structure:
 * - code: string (e.g., 'auth/network-request-failed')
 * - message: string
 * - customData: {
 *     appName: string (required)
 *     email?: string
 *     phoneNumber?: string
 *     tenantId?: string
 *     operationType?: string (for MultiFactorError)
 *     serverResponse?: object (internal, contains detailed server error)
 *   }
 * 
 * @see https://github.com/firebase/firebase-js-sdk/blob/main/common/api-review/auth.api.md
 */
function getFirebaseErrorDetails(error: unknown): Record<string, unknown> {
  const details: Record<string, unknown> = {
    error_message: error instanceof Error ? error.message : String(error),
    error_type: error instanceof Error ? error.constructor.name : typeof error,
  };

  // Extract Firebase-specific error details
  if (error && typeof error === 'object') {
    const firebaseError = error as Record<string, unknown>;
    
    // Firebase error code (documented field)
    if ('code' in firebaseError) {
      details.firebase_code = firebaseError.code;
    }
    
    // Extract customData fields (documented structure)
    if ('customData' in firebaseError && firebaseError.customData) {
      const customData = firebaseError.customData as Record<string, unknown>;
      
      // Documented AuthError fields
      if ('appName' in customData) {
        details.app_name = customData.appName;
      }
      if ('email' in customData && customData.email) {
        details.user_email = customData.email;
      }
      if ('phoneNumber' in customData && customData.phoneNumber) {
        details.phone_number = customData.phoneNumber;
      }
      if ('tenantId' in customData && customData.tenantId) {
        details.tenant_id = customData.tenantId;
      }
      if ('operationType' in customData && customData.operationType) {
        details.operation_type = customData.operationType;
      }
      
      // Internal server response (undocumented but useful for debugging)
      if ('serverResponse' in customData && customData.serverResponse) {
        const serverResponse = customData.serverResponse as Record<string, unknown>;
        
        // Extract key fields from server response
        if ('error' in serverResponse && serverResponse.error) {
          const serverError = serverResponse.error as Record<string, unknown>;
          if ('code' in serverError) {
            details.server_error_code = serverError.code;
          }
          if ('message' in serverError) {
            details.server_error_message = serverError.message;
          }
        }
        
        // Include full server response for debugging (limit size)
        // Use try-catch to handle non-serializable values (circular refs, BigInt, etc.)
        try {
          const serverResponseStr = JSON.stringify(serverResponse);
          if (serverResponseStr.length <= 500) {
            details.server_response = serverResponse;
          } else {
            details.server_response_preview = serverResponseStr.substring(0, 500);
            details.server_response_truncated = true;
          }
        } catch {
          // Failed to serialize - likely circular reference or non-serializable value
          details.server_response_error = 'Failed to serialize server response';
          details.server_response_type = typeof serverResponse;
          details.server_response_keys = Object.keys(serverResponse).join(', ');
        }
      }
    }
    
    // Include stack trace for debugging (first 500 chars)
    if ('stack' in firebaseError && typeof firebaseError.stack === 'string') {
      details.stack_preview = String(firebaseError.stack).substring(0, 500);
    }
  }

  return details;
}

function getExpoDevServerUrl(): string | null {
  // Try to detect dev server URL from Expo config
  const manifest2HostUri = Constants.expoConfig?.hostUri;
  if (manifest2HostUri) {
    logger.debug('Found hostUri from expoConfig', { feature: 'AuthService', hostUri: manifest2HostUri });
    return `http://${manifest2HostUri}`;
  }
  
  logger.warn('Could not detect dev server URL, falling back to localhost', { feature: 'AuthService' });
  return null;
}

export async function sendEmailVerificationCode(email: string): Promise<void> {
  let redirectUrl: string;
  
  logger.debug('Debug - Constants info', {
    feature: 'AuthService',
    executionEnvironment: Constants.executionEnvironment,
    expoConfigHostUri: Constants.expoConfig?.hostUri,
  });
  
  if (Platform.OS === 'web') {
    // Web: use current origin (localhost in dev, production URL in prod)
    redirectUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.EXPO_PUBLIC_APP_URL || 'https://boss-app.ozma.io';
  } else {
    // Mobile: check if dev server is available
    const devServerUrl = getExpoDevServerUrl();
    if (devServerUrl) {
      // Development mode: use dev server URL
      redirectUrl = devServerUrl;
      logger.debug('Development build detected', { feature: 'AuthService', redirectUrl });
    } else {
      // Production build: use custom domain
      redirectUrl = 'https://boss-app.ozma.io';
      logger.debug('Production build detected', { feature: 'AuthService', redirectUrl });
    }
  }
  
  const actionCodeSettings = {
    url: `${redirectUrl}?email=${email}`,
    handleCodeInApp: true,
    iOS: {
      bundleId: process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || 'com.ozmaio.bossup',
    },
    android: {
      packageName: process.env.EXPO_PUBLIC_ANDROID_PACKAGE || 'com.ozmaio.bossup',
      installApp: true,
    },
    linkDomain: 'boss-app.ozma.io',
  };

  logger.info('Sending sign-in link', {
    feature: 'AuthService',
    email,
    url: actionCodeSettings.url,
    handleCodeInApp: actionCodeSettings.handleCodeInApp,
  });

  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    logger.info('Sign-in link sent successfully', { feature: 'AuthService', email });
  } catch (error) {
    const errorDetails = getFirebaseErrorDetails(error);
    
    logger.error('Failed to send sign-in link', {
      feature: 'AuthService',
      email,
      platform: Platform.OS,
      error,
      ...errorDetails,
    });
    throw error;
  }
}

/**
 * Handle all post-sign-in operations
 * 
 * This unified function is called after successful authentication from any login method.
 * It handles:
 * 1. Amplitude event logging (auth_signin_completed)
 * 2. Ensuring user profile exists in Firestore (creating if needed)
 * 3. First app login tracking (Facebook events via handlePostLoginTracking)
 * 
 * This function consolidates all post-login logic into a single place to avoid
 * code duplication across verifyEmailCode, signInWithGoogle, and signInWithApple.
 * 
 * @param user - Firebase User object
 * @param method - Login method (email, Google, Apple)
 * @param additionalEventProps - Optional additional properties for Amplitude event
 * @returns The same User object (for chaining)
 */
async function handlePostSignIn(
  user: User, 
  method: LoginMethod,
  additionalEventProps?: Record<string, unknown>
): Promise<User> {
  try {
    // 1. Log successful sign-in to Amplitude
    trackAmplitudeEvent('auth_signin_completed', {
      method: method === 'email' ? 'email' : method.toLowerCase(),
      platform: Platform.OS,
      ...additionalEventProps,
    });
    
    // 2. Ensure user profile exists in Firestore (create if new user)
    // Returns userData with firstAppLoginAt field for tracking logic
    const userData = await ensureUserProfileExists(user.id, user.email);
    
    // 3. Handle first app login tracking (Facebook registration events)
    await handlePostLoginTracking(user.id, user.email, method, userData);
    
    return user;
  } catch (error) {
    logger.error('Error in post-sign-in operations', {
      feature: 'AuthService',
      userId: user.id,
      method,
      error,
    });
    // Don't throw - we want to let the user continue even if post-login operations fail
    // The user is already authenticated at this point
    return user;
  }
}

/**
 * Handle post-login tracking and Facebook events
 * 
 * This function is called after user authentication to:
 * 1. Check if this is the user's first app login (via userData.firstAppLoginAt)
 * 2. Send Facebook registration events if first login
 * 3. Mark first app login in Firestore
 * 
 * IMPORTANT: This function expects userData to already be loaded from Firestore
 * (typically by ensureUserProfileExists). This avoids duplicate Firestore reads
 * and race conditions.
 * 
 * @param userId - Firebase User ID
 * @param email - User email
 * @param method - Login method
 * @param userData - User document data from Firestore (must include firstAppLoginAt field)
 */
async function handlePostLoginTracking(
  userId: string,
  email: string,
  method: LoginMethod,
  userData: { firstAppLoginAt?: string | null }
): Promise<void> {
  try {
    // Check if this is first app login
    const isFirstLogin = !userData.firstAppLoginAt;
    
    if (!isFirstLogin) {
      logger.debug('Not first app login, skipping registration events', {
        feature: 'AuthService',
        userId,
        firstAppLoginAt: userData.firstAppLoginAt
      });
      return;
    }
    
    logger.info('First app login detected, sending registration events', {
      feature: 'AuthService',
      userId,
      email,
      method,
      platform: Platform.OS
    });
    
    // Platform-specific handling
    if (Platform.OS === 'ios') {
      // iOS: Navigate to tracking onboarding screen with isFirstLogin flag
      // tracking-onboarding.tsx will:
      // 1. Check Firestore firstAppLoginAt to prevent duplicate events (handles app crashes)
      // 2. Show ATT prompt
      // 3. Call sendFirstLoginEvents() to send Facebook events
      router.push(`/tracking-onboarding?email=${encodeURIComponent(email)}&method=${method}&isFirstLogin=true`);
    } else if (Platform.OS === 'android') {
      // Android: Send Facebook events directly (no ATT prompt needed)
      // Uses unified sendFirstLoginEvents() function
      await sendFirstLoginEvents(userId, email, method);
    } else {
      // Web and other platforms: Mark first login without Facebook events
      // Web doesn't require ATT prompts and Facebook events are primarily for mobile attribution
      // However, we still mark firstAppLoginAt for consistency across all platforms
      logger.info('Web or other platform detected, marking first login without Facebook events', {
        feature: 'AuthService',
        userId,
        platform: Platform.OS
      });
      
      try {
        const { markFirstAppLogin } = await import('@/services/user.service');
        await markFirstAppLogin(userId);
      } catch (markError) {
        logger.error('Failed to mark first app login', { feature: 'AuthService', userId, error: markError });
        // Don't throw - this shouldn't block user flow
      }
    }
  } catch (error) {
    logger.error('Error in post-login tracking', { feature: 'AuthService', userId, error });
    // Don't throw - tracking errors shouldn't block user flow
  }
}

export async function verifyEmailCode(email: string, emailLink: string): Promise<User> {
  try {
    trackAmplitudeEvent('auth_magic_link_clicked', {
      source: Platform.OS === 'web' ? 'browser' : 'email_client',
    });
    
    const userCredential = await signInWithEmailLink(auth, email, emailLink);
    const user = mapFirebaseUserToUser(userCredential.user);
    
    // Handle all post-sign-in operations (Amplitude, Firestore, Facebook events)
    return await handlePostSignIn(user, 'email');
  } catch (error) {
    const errorDetails = getFirebaseErrorDetails(error);
    
    logger.error('Email sign-in failed', {
      feature: 'AuthService',
      method: 'email_link',
      email,
      platform: Platform.OS,
      error,
      ...errorDetails,
    });
    
    trackAmplitudeEvent('auth_signin_failed', {
      method: 'email',
      error_type: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  }
}

export async function signInWithTestEmail(email: string): Promise<User> {
  try {
    const functions = getFunctions();
    const generateToken = httpsCallable<{ email: string }, { token: string }>(
      functions,
      'generateTestUserToken'
    );

    const result = await generateToken({ email });
    const customToken = result.data.token;

    const userCredential = await signInWithCustomToken(auth, customToken);
    const user = mapFirebaseUserToUser(userCredential.user);
    
    // Handle all post-sign-in operations (Amplitude, Firestore, Facebook events)
    // Note: Test users are tracked separately in Amplitude via is_test flag,
    // but still go through standard Facebook Custom Audiences tracking
    return await handlePostSignIn(user, 'email', { is_test: true });
  } catch (error) {
    const errorDetails = getFirebaseErrorDetails(error);
    
    logger.error('Test email sign-in failed', {
      feature: 'AuthService',
      method: 'test_email',
      email,
      platform: Platform.OS,
      error,
      ...errorDetails,
    });
    
    trackAmplitudeEvent('auth_signin_failed', {
      method: 'email',
      is_test: true,
      error_type: error instanceof Error ? error.message : 'unknown',
    });
    
    throw error;
  }
}

export async function signInWithGoogleCredential(idToken: string): Promise<User> {
  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    return mapFirebaseUserToUser(userCredential.user);
  } catch (error) {
    const errorDetails = getFirebaseErrorDetails(error);
    
    logger.error('Google credential sign-in failed', {
      feature: 'AuthService',
      method: 'google_credential',
      platform: Platform.OS,
      error,
      ...errorDetails,
    });
    
    throw error;
  }
}

/**
 * Initialize Google Sign-In configuration
 * Should be called once during app initialization
 */
export function initializeGoogleSignIn(): void {
  if (Platform.OS !== 'web') {
    try {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID,
        offlineAccess: false,
      });
      logger.info('Google Sign-In configured', { feature: 'AuthService', platform: Platform.OS });
    } catch (error) {
      logger.error('Failed to configure Google Sign-In', { feature: 'AuthService', error });
    }
  }
}

/**
 * Extract detailed error information from Apple Authentication errors
 * 
 * Apple Sign-In errors have the following structure:
 * - code: string (Expo error code like 'ERR_REQUEST_UNKNOWN', 'ERR_REQUEST_CANCELED', etc.)
 * - message: string (error message)
 * - nativeError: object (iOS native error with domain, code, userInfo)
 * 
 * Native iOS ASAuthorizationError codes:
 * - 1000 (unknown) - General unknown error, often means not signed into iCloud
 * - 1001 (canceled) - User explicitly cancelled
 * - 1002 (invalidResponse) - Invalid authorization response
 * - 1003 (notHandled) - Authorization request not handled
 * - 1004 (failed) - Authorization attempt failed
 * - 7022 (AKAuthenticationError) - Authentication service error (iCloud/Apple ID issues)
 * 
 * @see https://docs.expo.dev/versions/latest/sdk/apple-authentication/#error-codes
 * @see https://developer.apple.com/documentation/authenticationservices/asauthorizationerror
 */
function getAppleAuthErrorDetails(error: unknown): Record<string, unknown> {
  const details: Record<string, unknown> = {
    error_message: error instanceof Error ? error.message : String(error),
    error_type: error instanceof Error ? error.constructor.name : typeof error,
  };

  if (error && typeof error === 'object') {
    const appleError = error as Record<string, unknown>;
    
    // Expo error code (ERR_REQUEST_UNKNOWN, ERR_REQUEST_CANCELED, etc.)
    if ('code' in appleError && typeof appleError.code === 'string') {
      details.expo_error_code = appleError.code;
      
      // Map Expo codes to user-friendly categories
      switch (appleError.code) {
        case 'ERR_REQUEST_CANCELED':
          details.error_category = 'user_cancelled';
          break;
        case 'ERR_REQUEST_UNKNOWN':
          details.error_category = 'system_auth_error';
          break;
        case 'ERR_REQUEST_FAILED':
          details.error_category = 'auth_failed';
          break;
        case 'ERR_INVALID_RESPONSE':
          details.error_category = 'invalid_response';
          break;
        default:
          details.error_category = 'unknown';
      }
    }
    
    // Extract native iOS error details if available
    if ('nativeError' in appleError && appleError.nativeError && typeof appleError.nativeError === 'object') {
      const nativeError = appleError.nativeError as Record<string, unknown>;
      
      // Native error code (1000, 1001, 7022, etc.)
      if ('code' in nativeError && typeof nativeError.code === 'number') {
        details.native_error_code = nativeError.code;
        
        // Add human-readable interpretation
        switch (nativeError.code) {
          case 1000:
            details.native_error_name = 'ASAuthorizationError.unknown';
            details.likely_cause = 'Not signed into iCloud or Apple ID on device';
            break;
          case 1001:
            details.native_error_name = 'ASAuthorizationError.canceled';
            details.likely_cause = 'User cancelled authorization';
            break;
          case 1002:
            details.native_error_name = 'ASAuthorizationError.invalidResponse';
            details.likely_cause = 'Invalid authorization response from Apple';
            break;
          case 1003:
            details.native_error_name = 'ASAuthorizationError.notHandled';
            details.likely_cause = 'Authorization request not handled';
            break;
          case 1004:
            details.native_error_name = 'ASAuthorizationError.failed';
            details.likely_cause = 'Authorization attempt failed';
            break;
          case 7022:
            details.native_error_name = 'AKAuthenticationError';
            details.likely_cause = 'Apple authentication service error (iCloud/Apple ID issues)';
            break;
          default:
            details.native_error_name = `Unknown native code: ${nativeError.code}`;
        }
      }
      
      // Native error domain
      if ('domain' in nativeError && typeof nativeError.domain === 'string') {
        details.native_error_domain = nativeError.domain;
      }
      
      // Native error userInfo (additional context)
      if ('userInfo' in nativeError && nativeError.userInfo && typeof nativeError.userInfo === 'object') {
        const userInfo = nativeError.userInfo as Record<string, unknown>;
        
        // Extract NSUnderlyingError if present
        if ('NSUnderlyingError' in userInfo) {
          details.has_underlying_error = true;
          
          // Try to extract underlying error details
          const underlyingError = userInfo.NSUnderlyingError;
          if (underlyingError && typeof underlyingError === 'object') {
            const underlying = underlyingError as Record<string, unknown>;
            if ('code' in underlying) {
              details.underlying_error_code = underlying.code;
            }
            if ('domain' in underlying) {
              details.underlying_error_domain = underlying.domain;
            }
            if ('localizedDescription' in underlying) {
              details.underlying_error_description = underlying.localizedDescription;
            }
          }
        }
        
        // Extract localized description
        if ('NSLocalizedDescription' in userInfo && typeof userInfo.NSLocalizedDescription === 'string') {
          details.native_localized_description = userInfo.NSLocalizedDescription;
        }
      }
    }
    
    // Include stack trace for debugging (first 500 chars)
    if ('stack' in appleError && typeof appleError.stack === 'string') {
      details.stack_preview = String(appleError.stack).substring(0, 500);
    }
  }

  return details;
}

export async function signInWithGoogle(): Promise<User> {
  // For web platform: use web-based OAuth flow
  if (Platform.OS === 'web') {
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: process.env.EXPO_PUBLIC_APP_SCHEME || 'bossup',
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: GOOGLE_WEB_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'id_token',
        scope: 'openid profile email',
        nonce: Math.random().toString(36).substring(7),
      }).toString()}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type !== 'success') {
        throw new Error('Google Sign-In was cancelled or failed');
      }

      const url = result.url;
      const params = new URLSearchParams(url.split('#')[1]);
      const idToken = params.get('id_token');

      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      const user = await signInWithGoogleCredential(idToken);
      
      // Handle all post-sign-in operations (Amplitude, Firestore, Facebook events)
      return await handlePostSignIn(user, 'Google');
    } catch (error) {
      const errorDetails = getFirebaseErrorDetails(error);
      
      logger.error('Google sign-in failed (web)', {
        feature: 'AuthService',
        method: 'google_web',
        platform: 'web',
        error,
        ...errorDetails,
      });
      
      trackAmplitudeEvent('auth_signin_failed', {
        method: 'google',
        error_type: error instanceof Error ? error.message : 'unknown',
        platform: 'web',
      });
      throw error;
    }
  }
  
  // For iOS/Android: use native Google Sign-In SDK
  try {
    // Check if Play Services are available (Android only, always true on iOS)
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    // Perform native sign-in
    const response = await GoogleSignin.signIn();
    const idToken = response.data?.idToken;

    if (!idToken) {
      logger.info('Google Sign-In cancelled by user (no idToken)', { feature: 'AuthService' });
      throw new Error('Google Sign-In was cancelled');
    }

    const user = await signInWithGoogleCredential(idToken);
    
    // Handle all post-sign-in operations (Amplitude, Firestore, Facebook events)
    return await handlePostSignIn(user, 'Google');
  } catch (error) {
    // Handle specific Google Sign-In errors
    if (error && typeof error === 'object' && 'code' in error) {
      const errorCode = (error as { code: string }).code;
      
      // User cancelled sign-in
      if (errorCode === 'SIGN_IN_CANCELLED' || errorCode === '-5') {
        logger.info('Google Sign-In cancelled by user', { feature: 'AuthService' });
        throw new Error('Google Sign-In was cancelled');
      }
      
      // Play Services not available or outdated
      if (errorCode === 'PLAY_SERVICES_NOT_AVAILABLE') {
        logger.error('Google Play Services not available', { feature: 'AuthService' });
        throw new Error('Google Play Services not available. Please update Google Play Services.');
      }
    }
    
    // Check if this is a cancellation error (either our message or original message)
    if (error instanceof Error && (
      error.message === 'Google Sign-In was cancelled' ||
      error.message === 'No ID token received from Google'
    )) {
      // Already logged as info above, just re-throw without logging as error
      throw error;
    }
    
    const errorDetails = getFirebaseErrorDetails(error);
    
    logger.error('Google sign-in failed (native)', {
      feature: 'AuthService',
      method: 'google_native',
      platform: Platform.OS,
      error,
      ...errorDetails,
    });
    
    trackAmplitudeEvent('auth_signin_failed', {
      method: 'google',
      error_type: error instanceof Error ? error.message : 'unknown',
      platform: Platform.OS,
      native: true,
    });
    
    throw error;
  }
}

export async function signInWithApple(): Promise<User> {
  try {
    const nonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Math.random().toString()
    );

    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: appleCredential.identityToken || '',
      rawNonce: nonce,
    });

    const userCredential = await signInWithCredential(auth, credential);
    const user = mapFirebaseUserToUser(userCredential.user);
    
    // Handle all post-sign-in operations (Amplitude, Firestore, Facebook events)
    return await handlePostSignIn(user, 'Apple');
  } catch (error) {
    const errorDetails = getAppleAuthErrorDetails(error);
    
    logger.error('Apple sign-in failed', {
      feature: 'AuthService',
      method: 'apple',
      platform: Platform.OS,
      error,
      ...errorDetails,
    });
    
    // Build Amplitude event properties - only include defined values
    const amplitudeProps: Record<string, unknown> = {
      method: 'apple',
      error_type: errorDetails.error_category || (error instanceof Error ? error.message : 'unknown'),
    };
    
    // Only add error codes if they exist to maintain consistent event schema
    if (errorDetails.expo_error_code !== undefined) {
      amplitudeProps.error_code = errorDetails.expo_error_code;
    }
    if (errorDetails.native_error_code !== undefined) {
      amplitudeProps.native_error_code = errorDetails.native_error_code;
    }
    
    trackAmplitudeEvent('auth_signin_failed', amplitudeProps);
    throw error;
  }
}

export async function signOut(): Promise<void> {
  trackAmplitudeEvent('auth_signout_completed');
  
  await auth.signOut();
}

export function getCurrentUser(): User | null {
  const firebaseUser = auth.currentUser;
  return firebaseUser ? mapFirebaseUserToUser(firebaseUser) : null;
}

export function onAuthStateChanged(callback: (user: User | null) => void): () => void {
  return firebaseOnAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
    const user = firebaseUser ? mapFirebaseUserToUser(firebaseUser) : null;
    callback(user);
  });
}

function mapFirebaseUserToUser(firebaseUser: FirebaseUser): User {
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || '',
    createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
    currentScreen: null,
    lastActivityAt: null,
  };
}

