import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { enableIndexedDbPersistence, initializeFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || ""
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

console.log('[Firebase] Firestore initialized with auto-detect long polling');

if (Platform.OS === 'web') {
  enableIndexedDbPersistence(db)
    .then(() => {
      console.log('[Firebase] Offline persistence enabled successfully');
    })
    .catch((error) => {
      if (error.code === 'failed-precondition') {
        console.warn('[Firebase] Persistence failed: Multiple tabs open');
      } else if (error.code === 'unimplemented') {
        console.warn('[Firebase] Persistence not available in this browser');
      } else {
        console.error('[Firebase] Failed to enable persistence:', error);
      }
    });
}

