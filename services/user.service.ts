import { db } from '@/constants/firebase.config';
import { setAmplitudeUserProperties, trackAmplitudeEvent } from '@/services/amplitude.service';
import { NotificationPermissionStatus, NotificationPromptHistoryItem, Unsubscribe, UserNotificationData, UserProfile } from '@/types';
import { retryWithBackoff } from '@/utils/retryWithBackoff';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { AttributionData } from './attribution.service';
import { logger } from './logger.service';

const DAYS_BETWEEN_PROMPTS = 3;

function isFirebaseOfflineError(error: Error): boolean {
  return (
    error.message.includes('client is offline') ||
    error.message.includes('Failed to get document') ||
    error.name === 'FirebaseError'
  );
}

export async function getUserNotificationData(userId: string): Promise<UserNotificationData | null> {
  logger.time('getUserNotificationData');
  logger.debug('Getting notification data for user', { feature: 'UserService', userId });
  
  try {
    const result = await retryWithBackoff(async () => {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        logger.debug('User document does not exist', { feature: 'UserService', userId });
        return null;
      }
      
      const data = userDoc.data();
      
      return {
        notificationPermissionStatus: data.notificationPermissionStatus || 'not_asked',
        lastNotificationPromptAt: data.lastNotificationPromptAt || null,
        notificationPromptHistory: data.notificationPromptHistory || [],
      };
    }, 3, 500);
    
    logger.timeEnd('getUserNotificationData', { feature: 'UserService', userId });
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    
    if (isOffline) {
      logger.warn('Failed to get user data (offline), defaulting to null', {
        feature: 'UserService',
        userId,
        retries: 3,
      });
    } else {
      logger.error('Error getting user notification data', { feature: 'UserService', userId, error: err });
    }
    
    return null;
  }
}

export async function updateNotificationPermissionStatus(
  userId: string,
  status: NotificationPermissionStatus
): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    const historyItem: NotificationPromptHistoryItem = {
      timestamp: new Date().toISOString(),
      action: status === 'granted' ? 'granted' : 'denied',
    };
    
    if (userDoc.exists()) {
      const existingHistory = userDoc.data().notificationPromptHistory || [];
      await updateDoc(userDocRef, {
        notificationPermissionStatus: status,
        lastNotificationPromptAt: new Date().toISOString(),
        notificationPromptHistory: [...existingHistory, historyItem],
      });
    } else {
      await setDoc(userDocRef, {
        notificationPermissionStatus: status,
        lastNotificationPromptAt: new Date().toISOString(),
        notificationPromptHistory: [historyItem],
      });
    }
    
    // Track event in Amplitude
    trackAmplitudeEvent('notification_permission_responded', {
      status: status,
      platform: Platform.OS,
    });
    
    // Set user property in Amplitude
    await setAmplitudeUserProperties({
      notification_permission_status: status,
    });
    
    logger.info('Notification permission status updated and tracked', { feature: 'UserService', status });
  } catch (error) {
    logger.error('Error updating notification permission status', { feature: 'UserService', error });
    throw error;
  }
}

export async function recordNotificationPromptShown(userId: string): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    const historyItem: NotificationPromptHistoryItem = {
      timestamp: new Date().toISOString(),
      action: 'shown',
    };
    
    if (userDoc.exists()) {
      const existingHistory = userDoc.data().notificationPromptHistory || [];
      await updateDoc(userDocRef, {
        lastNotificationPromptAt: new Date().toISOString(),
        notificationPromptHistory: [...existingHistory, historyItem],
      });
    } else {
      await setDoc(userDocRef, {
        notificationPermissionStatus: 'not_asked',
        lastNotificationPromptAt: new Date().toISOString(),
        notificationPromptHistory: [historyItem],
      });
    }
  } catch (error) {
    logger.error('Error recording notification prompt shown', { feature: 'UserService', error });
    throw error;
  }
}

/**
 * Sync notification permission status from iOS/Android system to Firestore
 * 
 * IMPORTANT: The system permission status (iOS/Android) is the source of truth.
 * Firestore is only used for analytics, history, and re-prompt logic.
 */
async function syncNotificationStatusWithFirestore(
  userId: string,
  systemStatus: NotificationPermissionStatus,
  firestoreData: UserNotificationData | null
): Promise<void> {
  // If Firestore already has the correct status, no need to sync
  if (firestoreData?.notificationPermissionStatus === systemStatus) {
    logger.debug('Firestore already in sync with system status', { feature: 'UserService', systemStatus });
    return;
  }
  
  logger.info('Syncing notification status', {
    feature: 'UserService',
    systemStatus,
    firestoreStatus: firestoreData?.notificationPermissionStatus || 'null',
  });
  
  try {
    await updateNotificationPermissionStatus(userId, systemStatus);
    logger.info('Successfully synced notification status to Firestore', { feature: 'UserService' });
  } catch (error) {
    logger.error('Failed to sync notification status to Firestore', { feature: 'UserService', error });
  }
}

export async function shouldShowNotificationOnboarding(userId: string): Promise<boolean> {
  logger.time('shouldShowNotificationOnboarding');
  logger.debug('Checking if should show notification onboarding', { feature: 'UserService', userId });
  
  // Check current system status first
  const { getNotificationPermissionStatus } = await import('@/services/notification.service');
  const systemStatus = await getNotificationPermissionStatus();
  logger.debug('Current system notification status', { feature: 'UserService', systemStatus });
  
  // Get Firestore data
  const notificationData = await getUserNotificationData(userId);
  
  // If system status is 'granted', sync with Firestore and don't show onboarding
  if (systemStatus === 'granted') {
    await syncNotificationStatusWithFirestore(userId, systemStatus, notificationData);
    logger.timeEnd('shouldShowNotificationOnboarding', { feature: 'UserService', result: false, reason: 'granted' });
    return false;
  }
  
  // If no notification data in Firestore, show onboarding
  if (!notificationData) {
    logger.timeEnd('shouldShowNotificationOnboarding', { feature: 'UserService', result: true, reason: 'no_data' });
    return true;
  }
  
  // If never prompted before, show onboarding
  if (!notificationData.lastNotificationPromptAt) {
    logger.timeEnd('shouldShowNotificationOnboarding', { feature: 'UserService', result: true, reason: 'never_prompted' });
    return true;
  }
  
  // Check if enough time has passed since last prompt
  const lastPromptDate = new Date(notificationData.lastNotificationPromptAt);
  const daysSinceLastPrompt = (Date.now() - lastPromptDate.getTime()) / (1000 * 60 * 60 * 24);
  const shouldShow = daysSinceLastPrompt >= DAYS_BETWEEN_PROMPTS;
  
  logger.timeEnd('shouldShowNotificationOnboarding', {
    feature: 'UserService',
    result: shouldShow,
    daysSinceLastPrompt: daysSinceLastPrompt.toFixed(1),
  });
  
  return shouldShow;
}

/**
 * Update user attribution data in Firestore
 */
export async function updateUserAttribution(userId: string, attributionData: AttributionData): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      attribution: attributionData,
      updatedAt: new Date().toISOString(),
    });
    logger.info('Attribution data updated for user', { feature: 'UserService', userId });
  } catch (error) {
    logger.error('Error updating user attribution', { feature: 'UserService', userId, error });
    throw error;
  }
}

/**
 * Get user profile data from Firestore
 * 
 * @param userId - User ID
 * @returns User profile or null if not found
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  logger.time('getUserProfile');
  logger.debug('Getting profile for user', { feature: 'UserService', userId });
  
  try {
    const result = await retryWithBackoff(async () => {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        logger.debug('User profile does not exist', { feature: 'UserService', userId });
        return null;
      }
      
      return userDoc.data() as UserProfile;
    }, 3, 500);
    
    logger.timeEnd('getUserProfile', { feature: 'UserService', userId, found: result !== null });
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    
    if (isOffline) {
      logger.warn('Failed to get user profile (offline), returning null', {
        feature: 'UserService',
        userId,
        retries: 3,
      });
    } else {
      logger.error('Error getting user profile', { feature: 'UserService', userId, error: err });
    }
    
    return null;
  }
}

/**
 * Subscribe to real-time updates for user profile
 * 
 * @param userId - User ID
 * @param callback - Callback function called with profile data on updates
 * @returns Unsubscribe function to stop listening to updates
 */
export function subscribeToUserProfile(
  userId: string,
  callback: (profile: UserProfile | null) => void
): Unsubscribe {
  logger.debug('Subscribing to profile for user', { feature: 'UserService', userId });
  
  const userDocRef = doc(db, 'users', userId);
  
  return onSnapshot(
    userDocRef,
    (docSnapshot) => {
      if (docSnapshot.exists()) {
        const profile = docSnapshot.data() as UserProfile;
        logger.debug('User profile updated', { feature: 'UserService', userId });
        callback(profile);
      } else {
        logger.debug('User profile does not exist', { feature: 'UserService', userId });
        callback(null);
      }
    },
    (error) => {
      logger.error('Error in user profile subscription', { feature: 'UserService', userId, error });
      callback(null);
    }
  );
}

/**
 * Update user profile data
 * 
 * Supports updating core fields and custom fields.
 * Custom fields should use the `custom_` prefix.
 * 
 * @param userId - User ID
 * @param data - Partial profile data to update
 */
export async function updateUserProfile(
  userId: string,
  data: Partial<UserProfile>
): Promise<void> {
  try {
    logger.debug('Updating profile for user', { feature: 'UserService', userId });
    
    const userDocRef = doc(db, 'users', userId);
    
    await updateDoc(userDocRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    
    logger.info('Successfully updated profile', { feature: 'UserService', userId });
  } catch (error) {
    const err = error as Error;
    logger.error('Error updating user profile', { feature: 'UserService', userId, error: err });
    throw error;
  }
}

