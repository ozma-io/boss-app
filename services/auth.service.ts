import { auth } from '@/constants/firebase.config';
import { User } from '@/types';
import * as AppleAuthentication from 'expo-apple-authentication';
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
  signInWithEmailLink
} from 'firebase/auth';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

function getExpoDevServerUrl(): string | null {
  // In Expo Go, use http:// (required by Firebase)
  // The web version will handle redirecting back to Expo Go
  
  // Try manifest2 first (newer SDK versions)
  const manifest2HostUri = Constants.expoConfig?.hostUri;
  if (manifest2HostUri) {
    console.log('[Auth] Found hostUri from expoConfig:', manifest2HostUri);
    return `http://${manifest2HostUri}`;
  }
  
  // Try manifest (legacy)
  const manifestHostUri = (Constants.manifest2?.extra?.expoGo?.debuggerHost || 
                           Constants.manifest?.debuggerHost);
  if (manifestHostUri) {
    // debuggerHost format: "192.168.1.74:19000" - need to change port to 8081
    const host = manifestHostUri.split(':')[0];
    console.log('[Auth] Found debuggerHost, using:', `http://${host}:8081`);
    return `http://${host}:8081`;
  }
  
  console.warn('[Auth] Could not detect dev server URL, falling back to localhost');
  return null;
}

export async function sendEmailVerificationCode(email: string): Promise<void> {
  let redirectUrl: string;
  
  // Check if running in Expo Go or standalone build
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  
  // Debug: log all relevant Constants values
  console.log('[Auth] Debug - Constants info:', {
    executionEnvironment: Constants.executionEnvironment,
    expoConfigHostUri: Constants.expoConfig?.hostUri,
    manifest2DebuggerHost: Constants.manifest2?.extra?.expoGo?.debuggerHost,
    manifestDebuggerHost: Constants.manifest?.debuggerHost,
  });
  
  if (Platform.OS === 'web') {
    // Web: use localhost or production URL
    redirectUrl = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:8081';
  } else if (isExpoGo) {
    // Expo Go: automatically detect dev server IP address (prioritize auto-detection over env var for mobile)
    const devServerUrl = getExpoDevServerUrl();
    redirectUrl = devServerUrl || process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:8081';
    console.log('[Auth] Expo Go detected. Using redirect URL:', redirectUrl);
  } else {
    // Standalone build: use custom scheme
    const scheme = process.env.EXPO_PUBLIC_APP_SCHEME || 'bossapp';
    redirectUrl = `${scheme}://`;
    console.log('[Auth] Standalone build detected. Using redirect URL:', redirectUrl);
  }
  
  const actionCodeSettings = {
    url: `${redirectUrl}?email=${email}`,
    handleCodeInApp: true,
    iOS: {
      bundleId: process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || 'com.anonymous.bossapp',
    },
    android: {
      packageName: process.env.EXPO_PUBLIC_ANDROID_PACKAGE || 'com.anonymous.bossapp',
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

export async function signInWithGoogleCredential(idToken: string): Promise<User> {
  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  return mapFirebaseUserToUser(userCredential.user);
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

