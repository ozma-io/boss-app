import { auth } from '@/constants/firebase.config';
import { GOOGLE_WEB_CLIENT_ID } from '@/constants/google.config';
import { User } from '@/types';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
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

WebBrowser.maybeCompleteAuthSession();

function getExpoDevServerUrl(): string | null {
  // Try to detect dev server URL from Expo config
  const manifest2HostUri = Constants.expoConfig?.hostUri;
  if (manifest2HostUri) {
    console.log('[Auth] Found hostUri from expoConfig:', manifest2HostUri);
    return `http://${manifest2HostUri}`;
  }
  
  console.warn('[Auth] Could not detect dev server URL, falling back to localhost');
  return null;
}

export async function sendEmailVerificationCode(email: string): Promise<void> {
  let redirectUrl: string;
  
  // Debug: log all relevant Constants values
  console.log('[Auth] Debug - Constants info:', {
    executionEnvironment: Constants.executionEnvironment,
    expoConfigHostUri: Constants.expoConfig?.hostUri,
  });
  
  if (Platform.OS === 'web') {
    // Web: use localhost or production URL
    redirectUrl = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:8081';
  } else {
    // For development builds, check if dev server is available
    const devServerUrl = getExpoDevServerUrl();
    if (devServerUrl) {
      // Development mode: use HTTP URL
      redirectUrl = devServerUrl;
      console.log('[Auth] Development build detected. Using redirect URL:', redirectUrl);
    } else {
      // Production standalone build: use custom scheme
      const scheme = process.env.EXPO_PUBLIC_APP_SCHEME || 'bossapp';
      redirectUrl = `${scheme}://`;
      console.log('[Auth] Production build detected. Using redirect URL:', redirectUrl);
    }
  }
  
  const actionCodeSettings = {
    url: `${redirectUrl}?email=${email}`,
    handleCodeInApp: true,
    iOS: {
      bundleId: process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || 'com.ozmaio.bossapp',
    },
    android: {
      packageName: process.env.EXPO_PUBLIC_ANDROID_PACKAGE || 'com.ozmaio.bossapp',
      installApp: true,
    },
  };

  console.log('[Auth] Sending sign-in link with settings:', {
    url: actionCodeSettings.url,
    handleCodeInApp: actionCodeSettings.handleCodeInApp,
    iOS: actionCodeSettings.iOS,
    android: actionCodeSettings.android,
  });

  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    console.log('[Auth] Sign-in link sent successfully to:', email);
  } catch (error) {
    console.error('[Auth] Failed to send sign-in link:', error);
    throw error;
  }
}

export async function verifyEmailCode(email: string, emailLink: string): Promise<User> {
  const userCredential = await signInWithEmailLink(auth, email, emailLink);
  return mapFirebaseUserToUser(userCredential.user);
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
  return mapFirebaseUserToUser(userCredential.user);
}

export async function signInWithGoogleCredential(idToken: string): Promise<User> {
  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  return mapFirebaseUserToUser(userCredential.user);
}

export async function signInWithGoogle(): Promise<User> {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: process.env.EXPO_PUBLIC_APP_SCHEME || 'bossapp',
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

  return signInWithGoogleCredential(idToken);
}

export async function signInWithApple(): Promise<User> {
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
  return mapFirebaseUserToUser(userCredential.user);
}

export async function signOut(): Promise<void> {
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
  };
}

