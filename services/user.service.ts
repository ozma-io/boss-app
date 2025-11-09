import { db } from '@/constants/firebase.config';
import { NotificationPermissionStatus, NotificationPromptHistoryItem, UserNotificationData } from '@/types';
import { retryWithBackoff } from '@/utils/retryWithBackoff';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
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

export async function shouldShowNotificationOnboarding(userId: string): Promise<boolean> {
  const startTime = Date.now();
  console.log(`📊 [UserService] >>> Checking if should show notification onboarding for user: ${userId}`);
  
  const notificationData = await getUserNotificationData(userId);
  
  if (!notificationData) {
    const duration = Date.now() - startTime;
    console.log(`📊 [UserService] <<< No notification data found, will show onboarding (${duration}ms)`);
    return true;
  }
  
  if (notificationData.notificationPermissionStatus === 'granted') {
    const duration = Date.now() - startTime;
    console.log(`📊 [UserService] <<< Permission already granted, skipping onboarding (${duration}ms)`);
    return false;
  }
  
  if (!notificationData.lastNotificationPromptAt) {
    const duration = Date.now() - startTime;
    console.log(`📊 [UserService] <<< Never prompted before, will show onboarding (${duration}ms)`);
    return true;
  }
  
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

