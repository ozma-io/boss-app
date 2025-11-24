import { db } from '@/constants/firebase.config';
import { setAmplitudeUserProperties, trackAmplitudeEvent } from '@/services/amplitude.service';
import { ChatMessage, ChatThread, ContentItem, NotificationPermissionStatus, NotificationPromptHistoryItem, Unsubscribe, UserNotificationData, UserProfile, UserProfileUpdate } from '@/types';
import { retryWithBackoff } from '@/utils/retryWithBackoff';
import { addDoc, collection, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { AttributionData } from './attribution.service';
import { logger } from './logger.service';

const DAYS_BETWEEN_PROMPTS = 3;

/**
 * Welcome message shown to new users when they first join
 * 
 * ⚠️ DUPLICATED LOGIC WARNING:
 * This constant is duplicated in web-funnels repository:
 * - web-funnels/app/utils/constants.ts → CHAT_WELCOME_MESSAGE
 * - boss-app/functions/src/constants.ts → CHAT_WELCOME_MESSAGE (Cloud Functions)
 * 
 * If you change this message, please update ALL THREE locations:
 * 1. boss-app/services/user.service.ts (this file)
 * 2. web-funnels/app/utils/constants.ts
 * 3. boss-app/functions/src/constants.ts
 */
const CHAT_WELCOME_MESSAGE = `Welcome to BossUp! I'm your AI assistant ready to help you manage your relationship with your boss.

I can answer your questions anytime, and I'll sometimes reach out to you proactively with helpful insights. Make sure to enable notifications so you don't miss my messages!

I have access to all your data in the app, so I can provide personalized advice and support. Feel free to ask me anything!

Let's build your career together! 🚀`;

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
    
    const existingHistory = userDoc.data()?.notificationPromptHistory || [];
    await updateDoc(userDocRef, {
      notificationPermissionStatus: status,
      lastNotificationPromptAt: new Date().toISOString(),
      notificationPromptHistory: [...existingHistory, historyItem],
    });
    
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
    
    const existingHistory = userDoc.data()?.notificationPromptHistory || [];
    await updateDoc(userDocRef, {
      lastNotificationPromptAt: new Date().toISOString(),
      notificationPromptHistory: [...existingHistory, historyItem],
    });
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
 * Create chat thread with welcome message for new user
 * 
 * ⚠️ DUPLICATED LOGIC WARNING:
 * This function logic is duplicated in web-funnels repository:
 * - web-funnels/app/api/firebase/create-user/route.ts → createChatWithWelcomeMessage()
 * - boss-app/services/user.service.ts → createChatWithWelcomeMessage() (this file)
 * 
 * If you change this logic, please update BOTH locations:
 * 1. boss-app/services/user.service.ts (this file) 
 * 2. web-funnels/app/api/firebase/create-user/route.ts
 * 
 * This replaces the old Cloud Function approach (onUserCreated trigger)
 * which was removed to eliminate race conditions.
 * 
 * @param userId - User ID
 */
async function createChatWithWelcomeMessage(userId: string): Promise<void> {
  logger.debug('Creating chat thread with welcome message', { feature: 'UserService', userId });
  
  const threadId = 'main'; // Single thread per user for MVP
  const now = new Date().toISOString();
  
  try {
    const threadRef = doc(db, 'users', userId, 'chatThreads', threadId);
    
    // Welcome message content (OpenAI-compatible format)
    const welcomeContent: ContentItem[] = [
      {
        type: 'text',
        text: CHAT_WELCOME_MESSAGE,
      },
    ];
    
    // Create welcome message
    const welcomeMessage: ChatMessage = {
      role: 'assistant',
      content: welcomeContent,
      timestamp: now,
    };
    
    // Add message to collection FIRST (this triggers onChatMessageCreated)
    const messagesRef = collection(db, 'users', userId, 'chatThreads', threadId, 'messages');
    const messageRef = await addDoc(messagesRef, welcomeMessage);
    
    // Then create thread document with metadata
    // IMPORTANT: unreadCount = 0, onChatMessageCreated trigger will increment it to 1
    const threadData: ChatThread = {
      createdAt: now,
      updatedAt: now,
      messageCount: 1,
      assistantIsTyping: false,
      unreadCount: 0, // onChatMessageCreated trigger increments this
      lastReadAt: null,
      lastMessageAt: now,
      lastMessageRole: 'assistant',
    };
    
    await setDoc(threadRef, threadData);
    
    logger.info('Chat thread and welcome message created successfully', {
      feature: 'UserService',
      userId,
      threadId,
      messageId: messageRef.id,
    });
  } catch (error) {
    logger.error('Failed to create chat thread with welcome message', {
      feature: 'UserService',
      userId,
      error,
    });
    throw error;
  }
}

/**
 * Ensure user profile exists in Firestore
 * Creates the document with correct email from Auth if it doesn't exist
 * Also creates a default boss for new users who didn't come from web-funnel
 * 
 * Should be called once when user authenticates to guarantee the document exists
 * 
 * @param userId - User ID
 * @param userEmail - Email from Firebase Auth
 */
export async function ensureUserProfileExists(userId: string, userEmail: string): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      logger.info('Creating user profile document', { feature: 'UserService', userId, userEmail });
      
      const now = new Date().toISOString();
      
      // Create User document
      await setDoc(userDocRef, {
        email: userEmail,
        createdAt: now,
        name: '',
        goal: '',
        position: '',
      });
      
      logger.info('User profile document created', { feature: 'UserService', userId });
      
      // Create default boss for new users (web-funnel users already have a boss)
      // This ensures every user has at least one boss
      const bossesRef = collection(db, 'users', userId, 'bosses');
      const defaultBoss = {
        name: 'My Boss',
        position: 'Manager',
        birthday: '',
        managementStyle: '',
        startedAt: now,
        createdAt: now,
        updatedAt: now,
        _fieldsMeta: {},
      };
      
      const bossDocRef = await addDoc(bossesRef, defaultBoss);
      
      logger.info('Default boss created for new user', { 
        feature: 'UserService', 
        userId, 
        bossId: bossDocRef.id 
      });
      
      // Create chat thread with welcome message
      // This ensures new users have a welcome message immediately available
      await createChatWithWelcomeMessage(userId);
    } else {
      logger.debug('User profile already exists', { feature: 'UserService', userId });
    }
  } catch (error) {
    logger.error('Error ensuring user profile exists', { feature: 'UserService', userId, error });
    throw error;
  }
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
  data: UserProfileUpdate
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

/**
 * Update user presence (current screen tracking)
 * 
 * Used to prevent notifications when user is actively viewing a screen.
 * Updates are best-effort and non-critical (failures are logged but not thrown).
 * 
 * @param userId - User ID
 * @param currentScreen - Screen name ('chat', 'support', etc) or null when leaving
 */
export async function updateUserPresence(
  userId: string,
  currentScreen: string | null
): Promise<void> {
  try {
    logger.debug('Updating user presence', { feature: 'UserService', userId, currentScreen });
    
    const userDocRef = doc(db, 'users', userId);
    const now = new Date().toISOString();
    
    await updateDoc(userDocRef, {
      currentScreen,
      lastActivityAt: now,
    });
    
    logger.debug('User presence updated', { feature: 'UserService', userId, currentScreen });
  } catch (error) {
    const err = error as Error;
    // Presence updates are non-critical, just log the error
    logger.warn('Failed to update user presence (non-critical)', { 
      feature: 'UserService', 
      userId, 
      currentScreen, 
      error: err 
    });
    // Don't throw - app should continue working even if presence update fails
  }
}

