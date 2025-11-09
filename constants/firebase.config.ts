import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, initializeAuth, setPersistence } from 'firebase/auth';
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

// Initialize Auth with persistence for React Native
// In Firebase v12+, we need to use browser persistence options 
let auth;

if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  // For React Native, initialize with custom persistence
  auth = initializeAuth(app);
  // Set persistence to local (stored in IndexedDB in React Native)
  setPersistence(auth, browserLocalPersistence)
    .catch((error) => {
      console.error('Error setting auth persistence:', error);
    });
}

export { auth };

export const functions = getFunctions(app);

export const db = getFirestore(app);

