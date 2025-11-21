import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Functions, getFunctions } from 'firebase/functions';
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

// Initialize Firebase only in browser/mobile environment (not during SSR/SSG)
let app: ReturnType<typeof initializeApp> | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let functions: Functions | undefined;
let remoteConfig: RemoteConfig | null = null;

// Check if we're in a real runtime environment (not SSR/SSG build time)
// We want to initialize Firebase in:
// - Browser (web): has document object
// - React Native (iOS/Android): has Platform global from React Native
// We DON'T want to initialize during SSR/SSG builds in Node.js
//
// The check works as follows:
// - typeof document !== 'undefined': true in browser, false in Node.js SSR and React Native
// - typeof navigator !== 'undefined': true in browser and React Native (through polyfills), false in Node.js SSR
// Using navigator check ensures we init in both browser AND React Native environments
if (typeof navigator !== 'undefined') {
  app = initializeApp(firebaseConfig);

  // Initialize Auth with proper persistence
  // For React Native, we use AsyncStorage for persistence
  // For web, we use default persistence
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

  functions = getFunctions(app);
  db = getFirestore(app);

  // Initialize Remote Config (web only - native uses @react-native-firebase/remote-config)
  if (Platform.OS === 'web') {
    remoteConfig = getRemoteConfig(app);
    // Configure Remote Config settings
    remoteConfig.settings.minimumFetchIntervalMillis = __DEV__ 
      ? 0  // No cache in development
      : 3600000; // 1 hour cache in production
  }
}

// Export with type assertions for runtime usage
// During SSG build (typeof navigator === 'undefined'), these will be undefined
// But at actual runtime (in browser/mobile app), they will be properly initialized
// We use type assertion here to avoid changing all consuming files
export { app };
export const authInstance = auth as Auth;
export const dbInstance = db as Firestore;
export const functionsInstance = functions as Functions;
export { remoteConfig };

// Re-export with original names for backward compatibility
export { authInstance as auth, dbInstance as db, functionsInstance as functions };

