import { db } from '@/constants/firebase.config';
import { NotificationPermissionStatus, NotificationPromptHistoryItem, UserNotificationData } from '@/types';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const DAYS_BETWEEN_PROMPTS = 3;

export async function getUserNotificationData(userId: string): Promise<UserNotificationData | null> {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    const data = userDoc.data();
    
    return {
      notificationPermissionStatus: data.notificationPermissionStatus || 'not_asked',
      lastNotificationPromptAt: data.lastNotificationPromptAt || null,
      notificationPromptHistory: data.notificationPromptHistory || [],
    };
  } catch (error) {
    console.error('Error getting user notification data:', error);
    throw error;
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
  try {
    const notificationData = await getUserNotificationData(userId);
    
    if (!notificationData) {
      return true;
    }
    
    if (notificationData.notificationPermissionStatus === 'granted') {
      return false;
    }
    
    if (!notificationData.lastNotificationPromptAt) {
      return true;
    }
    
    const lastPromptDate = new Date(notificationData.lastNotificationPromptAt);
    const daysSinceLastPrompt = (Date.now() - lastPromptDate.getTime()) / (1000 * 60 * 60 * 24);
    
    return daysSinceLastPrompt >= DAYS_BETWEEN_PROMPTS;
  } catch (error) {
    console.error('Error checking if should show notification onboarding:', error);
    return false;
  }
}

