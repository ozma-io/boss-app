import Constants from 'expo-constants';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';
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

const isExpoGo = Constants.executionEnvironment === 'storeClient';
const shouldForceLongPolling = Platform.OS !== 'web' && isExpoGo;

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: shouldForceLongPolling,
  localCache: Platform.OS === 'web' 
    ? persistentLocalCache({ tabManager: persistentSingleTabManager({}) })
    : undefined,
});

if (shouldForceLongPolling) {
  console.log('[Firebase] Firestore initialized with FORCED Long Polling (Expo Go)');
} else if (Platform.OS === 'web') {
  console.log('[Firebase] Firestore initialized with WebSocket + Persistent Cache (Web)');
} else {
  console.log('[Firebase] Firestore initialized with WebSocket (Production build)');
}

