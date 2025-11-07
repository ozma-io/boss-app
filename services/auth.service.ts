import { auth } from '@/constants/firebase.config';
import { User } from '@/types';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import {
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInWithEmailLink,
  User as FirebaseUser
} from 'firebase/auth';

WebBrowser.maybeCompleteAuthSession();

export async function sendEmailVerificationCode(email: string): Promise<void> {
  let redirectUrl: string;
  
  if (Platform.OS === 'web') {
    redirectUrl = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:8081';
  } else if (Platform.OS === 'ios') {
    const scheme = process.env.EXPO_PUBLIC_APP_SCHEME || 'bossapp';
    redirectUrl = `${scheme}://`;
  } else if (Platform.OS === 'android') {
    const scheme = process.env.EXPO_PUBLIC_APP_SCHEME || 'bossapp';
    redirectUrl = `${scheme}://`;
  } else {
    redirectUrl = 'exp://localhost:8081';
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

  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
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

