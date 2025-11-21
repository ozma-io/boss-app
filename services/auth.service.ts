import { auth } from '@/constants/firebase.config';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '@/constants/google.config';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { clearTrackingAfterAuth, isFirstLaunch, markAppAsLaunched, needsTrackingAfterAuth } from '@/services/attribution.service';
import { sendAppInstallEventDual } from '@/services/facebook.service';
import { User } from '@/types';
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
    logger.error('Failed to send sign-in link', { feature: 'AuthService', email, error });
    throw error;
  }
}

export async function verifyEmailCode(email: string, emailLink: string): Promise<User> {
  try {
    trackAmplitudeEvent('auth_magic_link_clicked', {
      source: Platform.OS === 'web' ? 'browser' : 'email_client',
    });
    
    const userCredential = await signInWithEmailLink(auth, email, emailLink);
    const user = mapFirebaseUserToUser(userCredential.user);
    
    trackAmplitudeEvent('auth_signin_completed', {
      method: 'email',
    });
    
    // ============================================================
    // MAIN FLOW: Post-Login Tracking for Organic Users
    // ============================================================
    //
    // This is the PRIMARY tracking flow for most users:
    // 1. User installs app organically (App Store, friend referral, etc)
    // 2. User explores app, decides to sign up
    // 3. User logs in with email → WE ARE HERE
    // 4. Request tracking permission (iOS ATT prompt)
    // 5. Send Facebook events with email for attribution
    //
    // SPECIAL CASE: Users with Facebook attribution already sent
    // events at first launch (see app/_layout.tsx lines 154-171)
    //
    // ============================================================
    
    const needsTracking = await needsTrackingAfterAuth();
    const isFirst = await isFirstLaunch();
    
    if (needsTracking && isFirst) {
      logger.info('MAIN FLOW: Organic user logged in, triggering post-login tracking', {
        feature: 'AuthService',
        email,
        platform: Platform.OS
      });
      
      if (Platform.OS === 'ios') {
        // iOS: Navigate to tracking onboarding screen
        // User will see ATT prompt, then we send events with email
        // Note: We don't mark app as launched yet - tracking screen will do it
        router.push(`/tracking-onboarding?email=${encodeURIComponent(email)}`);
      } else if (Platform.OS === 'android') {
        // Android: Send events immediately (no prompt needed)
        try {
          await sendAppInstallEventDual(
            {}, // No attribution data (organic user)
            { email }
          );
          await clearTrackingAfterAuth();
          await markAppAsLaunched();
          logger.info('MAIN FLOW: Android tracking completed', { feature: 'AuthService' });
        } catch (fbError) {
          logger.error('MAIN FLOW: Failed to send tracking events', { feature: 'AuthService', error: fbError });
          // Don't block user flow on Facebook error
          await clearTrackingAfterAuth();
        }
      }
    }
    
    return user;
  } catch (error) {
    trackAmplitudeEvent('auth_signin_failed', {
      method: 'email',
      error_type: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  }
}

export async function signInWithTestEmail(email: string): Promise<User> {
  const functions = getFunctions();
  const generateToken = httpsCallable<{ email: string }, { token: string }>(
    functions,
    'generateTestUserToken'
  );

  const result = await generateToken({ email });
  const customToken = result.data.token;

  const userCredential = await signInWithCustomToken(auth, customToken);
  const user = mapFirebaseUserToUser(userCredential.user);
  
  trackAmplitudeEvent('auth_signin_completed', {
    method: 'email',
    is_test: true,
  });
  
  // MAIN FLOW: Post-login tracking (same as verifyEmailCode)
  const needsTracking = await needsTrackingAfterAuth();
  const isFirst = await isFirstLaunch();
  
  if (needsTracking && isFirst) {
    logger.info('MAIN FLOW: Test user logged in, triggering post-login tracking', {
      feature: 'AuthService',
      email,
      platform: Platform.OS
    });
    
    if (Platform.OS === 'ios') {
      router.push(`/tracking-onboarding?email=${encodeURIComponent(email)}`);
    } else if (Platform.OS === 'android') {
      try {
        await sendAppInstallEventDual({}, { email });
        await clearTrackingAfterAuth();
        await markAppAsLaunched();
      } catch (fbError) {
        logger.error('MAIN FLOW: Failed to send tracking events', { feature: 'AuthService', error: fbError });
        await clearTrackingAfterAuth();
      }
    }
  }
  
  return user;
}

export async function signInWithGoogleCredential(idToken: string): Promise<User> {
  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  return mapFirebaseUserToUser(userCredential.user);
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
      
      trackAmplitudeEvent('auth_signin_completed', {
        method: 'google',
        platform: 'web',
      });
      
      // MAIN FLOW: Post-login tracking (same as verifyEmailCode)
      const needsTracking = await needsTrackingAfterAuth();
      const isFirst = await isFirstLaunch();
      
      if (needsTracking && isFirst) {
        logger.info('MAIN FLOW: Google user logged in (web), triggering post-login tracking', {
          feature: 'AuthService',
          email: user.email,
          platform: 'web'
        });
        
        // Web platform: tracking not typically needed (no ATT on web)
        // But we clear the flag to avoid confusion
        await clearTrackingAfterAuth();
        logger.info('MAIN FLOW: Web platform - cleared tracking flag', { feature: 'AuthService' });
      }
      
      return user;
    } catch (error) {
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
    
    trackAmplitudeEvent('auth_signin_completed', {
      method: 'google',
      platform: Platform.OS,
      native: true,
    });
    
    // MAIN FLOW: Post-login tracking (same as verifyEmailCode)
    const needsTracking = await needsTrackingAfterAuth();
    const isFirst = await isFirstLaunch();
    
    if (needsTracking && isFirst) {
      logger.info('MAIN FLOW: Google user logged in (native), triggering post-login tracking', {
        feature: 'AuthService',
        email: user.email,
        platform: Platform.OS
      });
      
      if (Platform.OS === 'ios') {
        router.push(`/tracking-onboarding?email=${encodeURIComponent(user.email)}`);
      } else if (Platform.OS === 'android') {
        try {
          await sendAppInstallEventDual({}, { email: user.email });
          await clearTrackingAfterAuth();
          await markAppAsLaunched();
        } catch (fbError) {
          logger.error('MAIN FLOW: Failed to send tracking events', { feature: 'AuthService', error: fbError });
          await clearTrackingAfterAuth();
        }
      }
    }
    
    return user;
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
    
    logger.error('Google Sign-In failed', { feature: 'AuthService', error });
    
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
    
    trackAmplitudeEvent('auth_signin_completed', {
      method: 'apple',
    });
    
    // MAIN FLOW: Post-login tracking (same as verifyEmailCode)
    const needsTracking = await needsTrackingAfterAuth();
    const isFirst = await isFirstLaunch();
    
    if (needsTracking && isFirst) {
      logger.info('MAIN FLOW: Apple user logged in, triggering post-login tracking', {
        feature: 'AuthService',
        email: user.email,
        platform: Platform.OS
      });
      
      if (Platform.OS === 'ios') {
        router.push(`/tracking-onboarding?email=${encodeURIComponent(user.email)}`);
      } else if (Platform.OS === 'android') {
        try {
          await sendAppInstallEventDual({}, { email: user.email });
          await clearTrackingAfterAuth();
          await markAppAsLaunched();
        } catch (fbError) {
          logger.error('MAIN FLOW: Failed to send tracking events', { feature: 'AuthService', error: fbError });
          await clearTrackingAfterAuth();
        }
      }
    }
    
    return user;
  } catch (error) {
    trackAmplitudeEvent('auth_signin_failed', {
      method: 'apple',
      error_type: error instanceof Error ? error.message : 'unknown',
    });
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

