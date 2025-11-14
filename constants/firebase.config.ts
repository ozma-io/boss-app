import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getRemoteConfig, RemoteConfig } from 'firebase/remote-config';
import { Platform } from 'react-native';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || ""
};

const app = initializeApp(firebaseConfig);

// Initialize Auth with proper persistence
// For React Native, we use AsyncStorage for persistence
// For web, we use default persistence
let auth: Auth;

if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  // Import getReactNativePersistence dynamically to avoid TypeScript issues
  // @ts-ignore - TypeScript doesn't recognize this export but it exists at runtime
  const { getReactNativePersistence } = require('firebase/auth');
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

export { app, auth };

export const functions = getFunctions(app);

export const db = getFirestore(app);

// Initialize Remote Config (web only - native uses @react-native-firebase/remote-config)
let remoteConfig: RemoteConfig | null = null;
if (Platform.OS === 'web') {
  remoteConfig = getRemoteConfig(app);
  // Configure Remote Config settings
  remoteConfig.settings.minimumFetchIntervalMillis = __DEV__ 
    ? 0  // No cache in development
    : 3600000; // 1 hour cache in production
}

export { remoteConfig };
