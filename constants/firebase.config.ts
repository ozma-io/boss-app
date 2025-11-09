import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';

// We'll use direct conditional imports instead of dynamic imports
// This ensures compatibility with the Firebase initialization

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || ""
};

const app = initializeApp(firebaseConfig);

// Initialize Auth with platform-specific persistence
// For Web we use default persistence, for React Native we use AsyncStorage
export const auth = Platform.OS === 'web'
  ? getAuth(app) // Use standard auth for web
  : (() => {
      // For React Native, we use a direct import instead of the dynamic import above
      // This ensures that auth is initialized properly at module load time
      try {
        // We need to import this here again to ensure it's available during initialization
        const { getReactNativePersistence } = require('firebase/auth/react-native');
        return initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage)
        });
      } catch (error) {
        console.error("Error initializing Firebase Auth for native:", error);
        // Fallback to standard auth if React Native persistence isn't available
        return getAuth(app);
      }
    })();

export const functions = getFunctions(app);

export const db = getFirestore(app);

