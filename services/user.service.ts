import { db } from '@/constants/firebase.config';
import { setAmplitudeUserProperties, trackAmplitudeEvent } from '@/services/amplitude.service';
import { NotificationPermissionStatus, NotificationPromptHistoryItem, Unsubscribe, UserNotificationData, UserProfile } from '@/types';
import { retryWithBackoff } from '@/utils/retryWithBackoff';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { AttributionData } from './attribution.service';

const DAYS_BETWEEN_PROMPTS = 3;

function isFirebaseOfflineError(error: Error): boolean {
  return (
    error.message.includes('client is offline') ||
    error.message.includes('Failed to get document') ||
    error.name === 'FirebaseError'
  );
}

export async function getUserNotificationData(userId: string): Promise<UserNotificationData | null> {
  const startTime = Date.now();
  console.log(`📊 [UserService] >>> Getting notification data for user: ${userId} at ${new Date().toISOString()}`);
  
  try {
    const result = await retryWithBackoff(async () => {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.log(`📊 [UserService] User document does not exist: ${userId}`);
        return null;
      }
      
      const data = userDoc.data();
      
      return {
        notificationPermissionStatus: data.notificationPermissionStatus || 'not_asked',
        lastNotificationPromptAt: data.lastNotificationPromptAt || null,
        notificationPromptHistory: data.notificationPromptHistory || [],
      };
    }, 3, 500);
    
    const duration = Date.now() - startTime;
    console.log(`📊 [UserService] <<< Successfully retrieved notification data in ${duration}ms`);
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    const duration = Date.now() - startTime;
    
    if (isOffline) {
      console.warn(
        `📊 [UserService] Failed to get user data after 3 retries (offline) in ${duration}ms. User: ${userId}. Defaulting to null.`
      );
    } else {
      console.error(
        `📊 [UserService] Error getting user notification data for ${userId} after ${duration}ms:`,
        err.message
      );
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
    
    console.log('[UserService] Notification permission status updated and tracked in Amplitude:', status);
  } catch (error) {
    console.error('Error updating notification permission status:', error);
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
    console.error('Error recording notification prompt shown:', error);
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
    console.log(`📊 [UserService] Firestore already in sync with system status: ${systemStatus}`);
    return;
  }
  
  console.log(
    `📊 [UserService] Syncing notification status - System: ${systemStatus}, ` +
    `Firestore: ${firestoreData?.notificationPermissionStatus || 'null'}`
  );
  
  try {
    await updateNotificationPermissionStatus(userId, systemStatus);
    console.log(`📊 [UserService] Successfully synced notification status to Firestore`);
  } catch (error) {
    console.error('[UserService] Failed to sync notification status to Firestore:', error);
  }
}

export async function shouldShowNotificationOnboarding(userId: string): Promise<boolean> {
  const startTime = Date.now();
  console.log(`📊 [UserService] >>> Checking if should show notification onboarding for user: ${userId}`);
  
  // Check current system status first
  const { getNotificationPermissionStatus } = await import('@/services/notification.service');
  const systemStatus = await getNotificationPermissionStatus();
  console.log(`📊 [UserService] Current system notification status: ${systemStatus}`);
  
  // Get Firestore data
  const notificationData = await getUserNotificationData(userId);
  
  // If system status is 'granted', sync with Firestore and don't show onboarding
  if (systemStatus === 'granted') {
    await syncNotificationStatusWithFirestore(userId, systemStatus, notificationData);
    const duration = Date.now() - startTime;
    console.log(
      `📊 [UserService] <<< System status is granted, ` +
      `skipping onboarding (${duration}ms)`
    );
    return false;
  }
  
  // If no notification data in Firestore, show onboarding
  if (!notificationData) {
    const duration = Date.now() - startTime;
    console.log(`📊 [UserService] <<< No notification data found, will show onboarding (${duration}ms)`);
    return true;
  }
  
  // If never prompted before, show onboarding
  if (!notificationData.lastNotificationPromptAt) {
    const duration = Date.now() - startTime;
    console.log(`📊 [UserService] <<< Never prompted before, will show onboarding (${duration}ms)`);
    return true;
  }
  
  // Check if enough time has passed since last prompt
  const lastPromptDate = new Date(notificationData.lastNotificationPromptAt);
  const daysSinceLastPrompt = (Date.now() - lastPromptDate.getTime()) / (1000 * 60 * 60 * 24);
  const shouldShow = daysSinceLastPrompt >= DAYS_BETWEEN_PROMPTS;
  const duration = Date.now() - startTime;
  
  console.log(
    `📊 [UserService] <<< Last prompted ${daysSinceLastPrompt.toFixed(1)} days ago, ` +
    `${shouldShow ? 'will show' : 'will skip'} onboarding (${duration}ms)`
  );
  
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
    console.log('[UserService] Attribution data updated for user:', userId);
  } catch (error) {
    console.error('[UserService] Error updating user attribution:', error);
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
  const startTime = Date.now();
  console.log(`📊 [UserService] >>> Getting profile for user: ${userId} at ${new Date().toISOString()}`);
  
  try {
    const result = await retryWithBackoff(async () => {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.log(`📊 [UserService] User profile does not exist: ${userId}`);
        return null;
      }
      
      return userDoc.data() as UserProfile;
    }, 3, 500);
    
    const duration = Date.now() - startTime;
    console.log(`📊 [UserService] <<< Successfully retrieved profile in ${duration}ms`);
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    const duration = Date.now() - startTime;
    
    if (isOffline) {
      console.warn(
        `📊 [UserService] Failed to get user profile after 3 retries (offline) in ${duration}ms. User: ${userId}. Returning null.`
      );
    } else {
      console.error(
        `📊 [UserService] Error getting user profile for ${userId} after ${duration}ms:`,
        err.message
      );
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
  console.log(`📊 [UserService] >>> Subscribing to profile for user: ${userId}`);
  
  const userDocRef = doc(db, 'users', userId);
  
  return onSnapshot(
    userDocRef,
    (docSnapshot) => {
      if (docSnapshot.exists()) {
        const profile = docSnapshot.data() as UserProfile;
        console.log(`📊 [UserService] User profile updated for ${userId}`);
        callback(profile);
      } else {
        console.log(`📊 [UserService] User profile does not exist for ${userId}`);
        callback(null);
      }
    },
    (error) => {
      console.error(`📊 [UserService] Error in user profile subscription for ${userId}:`, error);
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
    console.log(`📊 [UserService] >>> Updating profile for user: ${userId}`);
    
    const userDocRef = doc(db, 'users', userId);
    
    await updateDoc(userDocRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    
    console.log(`📊 [UserService] <<< Successfully updated profile for ${userId}`);
  } catch (error) {
    const err = error as Error;
    console.error(`📊 [UserService] Error updating user profile for ${userId}:`, err.message);
    throw error;
  }
}

