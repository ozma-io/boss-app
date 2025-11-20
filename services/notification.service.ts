import { logger } from '@/services/logger.service';
import { NotificationPermissionStatus } from '@/types';
import { Platform, PermissionsAndroid } from 'react-native';

// Only import on native platforms to avoid web initialization warnings
let Notifications: any = null;
if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
}

export async function requestNotificationPermissions(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'ios') {
    if (!Notifications) {
      logger.warn('Notifications module not available', { feature: 'Notification' });
      return 'not_asked';
    }
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    if (existingStatus === 'granted') {
      return 'granted';
    }

    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (status === 'granted') {
      return 'granted';
    } else if (status === 'denied') {
      return 'denied';
    } else {
      return 'denied';
    }
  } else if (Platform.OS === 'android') {
    if (!Notifications) {
      logger.warn('Notifications module not available', { feature: 'Notification' });
      return 'not_asked';
    }
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    if (existingStatus === 'granted') {
      return 'granted';
    }

    // Use native Android API for Android 13+ (API 33+)
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );

    if (result === PermissionsAndroid.RESULTS.GRANTED) {
      return 'granted';
    } else if (result === PermissionsAndroid.RESULTS.DENIED || result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      return 'denied';
    } else {
      return 'denied';
    }
  }

  return 'not_asked';
}

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'ios') {
    if (!Notifications) {
      logger.warn('Notifications module not available', { feature: 'Notification' });
      return 'not_asked';
    }
    const { status } = await Notifications.getPermissionsAsync();
    
    if (status === 'granted') {
      return 'granted';
    } else if (status === 'denied') {
      return 'denied';
    } else {
      return 'not_asked';
    }
  } else if (Platform.OS === 'android') {
    if (!Notifications) {
      logger.warn('Notifications module not available', { feature: 'Notification' });
      return 'not_asked';
    }
    
    const { status } = await Notifications.getPermissionsAsync();
    
    if (status === 'granted') {
      return 'granted';
    } else if (status === 'denied') {
      return 'denied';
    } else {
      return 'not_asked';
    }
  }

  return 'not_asked';
}

// Import Firebase Messaging modular API (native only)
let getMessagingFn: any = null;
let requestPermissionFn: any = null;
let getTokenFn: any = null;
let onTokenRefreshFn: any = null;
let AuthorizationStatus: any = null;

if (Platform.OS !== 'web') {
  // iOS/Android: use React Native Firebase modular API
  const messagingModule = require('@react-native-firebase/messaging/lib/modular');
  getMessagingFn = messagingModule.getMessaging;
  requestPermissionFn = messagingModule.requestPermission;
  getTokenFn = messagingModule.getToken;
  onTokenRefreshFn = messagingModule.onTokenRefresh;
  AuthorizationStatus = messagingModule.AuthorizationStatus;
}

/**
 * Get FCM token from Firebase and save it to Firestore
 * Should be called ONLY after notification permission is already granted
 */
export async function registerFCMToken(userId: string): Promise<void> {
  if (Platform.OS === 'web' || !getMessagingFn) {
    logger.debug('FCM token registration not available on web', { feature: 'NotificationService' });
    return;
  }

  try {
    // Get messaging instance
    const messaging = getMessagingFn();

    // Get FCM token
    const fcmToken = await getTokenFn(messaging);
    
    if (!fcmToken) {
      logger.warn('Failed to get FCM token', { feature: 'NotificationService' });
      return;
    }

    logger.info('Got FCM token', { feature: 'NotificationService', userId });

    // Save to Firestore
    const { db } = await import('@/constants/firebase.config');
    const { doc, updateDoc } = await import('firebase/firestore');
    
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      fcmToken: fcmToken,
    });

    logger.info('FCM token saved to Firestore', { feature: 'NotificationService', userId });
  } catch (error) {
    // Handle TOO_MANY_REGISTRATIONS gracefully - don't crash the app
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('TOO_MANY_REGISTRATIONS')) {
      logger.warn('FCM token registration limit reached. User needs to reinstall the app or clear app data.', { 
        feature: 'NotificationService',
        userId,
        error: errorMessage
      });
      // Don't throw - let the app continue working
      return;
    }
    
    logger.error('Error registering FCM token', { feature: 'NotificationService', error });
    // For other errors, still don't throw to avoid crashing the app
  }
}

/**
 * Setup FCM token refresh listener
 * Call this once when app starts to handle token updates
 */
export function setupFCMTokenRefreshListener(userId: string): (() => void) | null {
  if (Platform.OS === 'web' || !getMessagingFn) {
    return null;
  }

  // Get messaging instance
  const messaging = getMessagingFn();

  // Listen for token refresh
  const unsubscribe = onTokenRefreshFn(messaging, async (fcmToken: string) => {
    logger.info('FCM token refreshed', { feature: 'NotificationService', userId });
    
    try {
      const { db } = await import('@/constants/firebase.config');
      const { doc, updateDoc } = await import('firebase/firestore');
      
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        fcmToken: fcmToken,
      });
      
      logger.info('Refreshed FCM token saved to Firestore', { feature: 'NotificationService', userId });
    } catch (error) {
      logger.error('Error saving refreshed FCM token', { feature: 'NotificationService', error });
    }
  });

  return unsubscribe;
}

