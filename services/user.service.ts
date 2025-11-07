import { db } from '@/constants/firebase.config';
import { NotificationPermissionStatus, NotificationPromptHistoryItem, UserNotificationData } from '@/types';
import { retryWithBackoff } from '@/utils/retryWithBackoff';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const DAYS_BETWEEN_PROMPTS = 3;

function isFirebaseOfflineError(error: Error): boolean {
  return (
    error.message.includes('client is offline') ||
    error.message.includes('Failed to get document') ||
    error.name === 'FirebaseError'
  );
}

export async function getUserNotificationData(userId: string): Promise<UserNotificationData | null> {
  console.log(`[UserService] Getting notification data for user: ${userId}`);
  
  try {
    const result = await retryWithBackoff(async () => {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.log(`[UserService] User document does not exist: ${userId}`);
        return null;
      }
      
      const data = userDoc.data();
      
      return {
        notificationPermissionStatus: data.notificationPermissionStatus || 'not_asked',
        lastNotificationPromptAt: data.lastNotificationPromptAt || null,
        notificationPromptHistory: data.notificationPromptHistory || [],
      };
    }, 3, 500);
    
    console.log(`[UserService] Successfully retrieved notification data for user: ${userId}`);
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    
    if (isOffline) {
      console.warn(
        `[UserService] Failed to get user data after 3 retries (offline). User: ${userId}. Defaulting to null.`
      );
    } else {
      console.error(
        `[UserService] Error getting user notification data for ${userId}:`,
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
  console.log(`[UserService] Checking if should show notification onboarding for user: ${userId}`);
  
  const notificationData = await getUserNotificationData(userId);
  
  if (!notificationData) {
    console.log(`[UserService] No notification data found, will show onboarding`);
    return true;
  }
  
  if (notificationData.notificationPermissionStatus === 'granted') {
    console.log(`[UserService] Permission already granted, skipping onboarding`);
    return false;
  }
  
  if (!notificationData.lastNotificationPromptAt) {
    console.log(`[UserService] Never prompted before, will show onboarding`);
    return true;
  }
  
  const lastPromptDate = new Date(notificationData.lastNotificationPromptAt);
  const daysSinceLastPrompt = (Date.now() - lastPromptDate.getTime()) / (1000 * 60 * 60 * 24);
  const shouldShow = daysSinceLastPrompt >= DAYS_BETWEEN_PROMPTS;
  
  console.log(
    `[UserService] Last prompted ${daysSinceLastPrompt.toFixed(1)} days ago, ` +
    `${shouldShow ? 'will show' : 'will skip'} onboarding`
  );
  
  return shouldShow;
}

