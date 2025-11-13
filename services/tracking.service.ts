import { db } from '@/constants/firebase.config';
import { setAmplitudeUserProperties, trackAmplitudeEvent } from '@/services/amplitude.service';
import { logger } from '@/services/logger.service';
import { retryWithBackoff } from '@/utils/retryWithBackoff';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

// Create mock module for web platforms
// Real module will be imported only on native platforms
const TrackingTransparency = Platform.OS === 'web' 
  ? {
      // Mock implementation for web
      getTrackingPermissionsAsync: async () => ({ status: 'granted' }),
      requestTrackingPermissionsAsync: async () => ({ status: 'granted' })
    }
  : Platform.OS === 'android'
    ? {
        // Mock implementation for Android (ATT is iOS only)
        getTrackingPermissionsAsync: async () => ({ status: 'granted' }),
        requestTrackingPermissionsAsync: async () => ({ status: 'granted' })
      }
    : require('expo-tracking-transparency'); // Only import on iOS

// Number of days to wait before showing the tracking prompt again
const DAYS_BETWEEN_TRACKING_PROMPTS = 14; // 2 weeks

export type TrackingPermissionStatus = 'authorized' | 'denied' | 'not_determined' | 'restricted';

export interface TrackingPromptHistoryItem {
  timestamp: string;
  action: 'shown' | 'authorized' | 'denied';
}

export interface UserTrackingData {
  trackingPermissionStatus: TrackingPermissionStatus;
  lastTrackingPromptAt: string | null;
  trackingPromptHistory: TrackingPromptHistoryItem[];
  trackingPromptCount: number;
}

function isFirebaseOfflineError(error: Error): boolean {
  return (
    error.message.includes('client is offline') ||
    error.message.includes('Failed to get document') ||
    error.name === 'FirebaseError'
  );
}

/**
 * Get tracking permission data for a user
 */
export async function getUserTrackingData(userId: string): Promise<UserTrackingData | null> {
  const startTime = Date.now();
  logger.info('Getting tracking data for user', { feature: 'TrackingService', userId });
  
  try {
    const result = await retryWithBackoff(async () => {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        return null;
      }
      
      const data = userDoc.data();
      
      return {
        trackingPermissionStatus: data.trackingPermissionStatus || 'not_determined',
        lastTrackingPromptAt: data.lastTrackingPromptAt || null,
        trackingPromptHistory: data.trackingPromptHistory || [],
        trackingPromptCount: data.trackingPromptCount || 0
      };
    }, 3, 500);
    
    const duration = Date.now() - startTime;
    logger.info('Successfully retrieved tracking data', { feature: 'TrackingService', duration });
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    const duration = Date.now() - startTime;
    
    if (isOffline) {
      logger.warn('Failed to get user tracking data after 3 retries (offline). Defaulting to null', { 
        feature: 'TrackingService', 
        userId, 
        duration 
      });
    } else {
      logger.error('Error getting user tracking data', { 
        feature: 'TrackingService', 
        userId, 
        duration,
        error: err
      });
    }
    
    return null;
  }
}

/**
 * Update tracking permission status in Firestore
 */
export async function updateTrackingPermissionStatus(
  userId: string,
  status: TrackingPermissionStatus
): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    const historyItem: TrackingPromptHistoryItem = {
      timestamp: new Date().toISOString(),
      action: status === 'authorized' ? 'authorized' : 'denied',
    };
    
    const existingHistory = userDoc.data()?.trackingPromptHistory || [];
    const existingCount = userDoc.data()?.trackingPromptCount || 0;
    
    await updateDoc(userDocRef, {
      trackingPermissionStatus: status,
      lastTrackingPromptAt: new Date().toISOString(),
      trackingPromptHistory: [...existingHistory, historyItem],
      trackingPromptCount: existingCount + 1
    });
    
    // Track event in Amplitude
    trackAmplitudeEvent('tracking_permission_responded', {
      status: status,
      platform: Platform.OS,
    });
    
    // Set user property in Amplitude
    await setAmplitudeUserProperties({
      tracking_permission_status: status,
    });
    
    logger.info('Tracking permission status updated and tracked in Amplitude', { feature: 'TrackingService', status });
  } catch (error) {
    logger.error('Error updating tracking permission status', { feature: 'TrackingService', error });
    throw error;
  }
}

/**
 * Record that tracking prompt was shown to the user
 */
export async function recordTrackingPromptShown(userId: string): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    const historyItem: TrackingPromptHistoryItem = {
      timestamp: new Date().toISOString(),
      action: 'shown',
    };
    
    const existingHistory = userDoc.data()?.trackingPromptHistory || [];
    const existingCount = userDoc.data()?.trackingPromptCount || 0;
    
    await updateDoc(userDocRef, {
      lastTrackingPromptAt: new Date().toISOString(),
      trackingPromptHistory: [...existingHistory, historyItem],
      trackingPromptCount: existingCount + 1
    });
  } catch (error) {
    logger.error('Error recording tracking prompt shown', { feature: 'TrackingService', error });
    throw error;
  }
}

/**
 * Sync tracking permission status from iOS/Android system to Firestore
 * 
 * IMPORTANT: The system permission status (iOS/Android) is the source of truth.
 * Firestore is only used for analytics, history, and re-prompt logic.
 */
async function syncTrackingStatusWithFirestore(
  userId: string,
  systemStatus: TrackingPermissionStatus,
  firestoreData: UserTrackingData | null
): Promise<void> {
  // If Firestore already has the correct status, no need to sync
  if (firestoreData?.trackingPermissionStatus === systemStatus) {
    logger.info('Firestore already in sync with system status', { feature: 'TrackingService', systemStatus });
    return;
  }
  
  logger.info('Syncing status', { 
    feature: 'TrackingService', 
    systemStatus, 
    firestoreStatus: firestoreData?.trackingPermissionStatus || 'null' 
  });
  
  try {
    await updateTrackingPermissionStatus(userId, systemStatus);
    logger.info('Successfully synced tracking status to Firestore', { feature: 'TrackingService' });
  } catch (error) {
    logger.error('Failed to sync tracking status to Firestore', { feature: 'TrackingService', error });
  }
}

/**
 * Check if the tracking onboarding should be shown to the user
 * This checks permission status and time since last prompt
 */
export async function shouldShowTrackingOnboarding(userId: string): Promise<boolean> {
  const startTime = Date.now();
  logger.info('Checking if should show tracking onboarding', { feature: 'TrackingService', userId });
  
  // First, check if ATT is available (iOS 14+)
  if (Platform.OS !== 'ios') {
    const duration = Date.now() - startTime;
    logger.info('Not iOS platform, no need for ATT onboarding', { feature: 'TrackingService', duration });
    return false;
  }
  
  // Check current system status first
  const systemStatus = await getTrackingPermissionStatus();
  logger.info('Current system tracking status', { feature: 'TrackingService', systemStatus });
  
  // Get Firestore data
  const trackingData = await getUserTrackingData(userId);
  
  // If system has already determined status (granted or denied), sync with Firestore and don't show onboarding
  if (systemStatus === 'authorized' || systemStatus === 'denied') {
    await syncTrackingStatusWithFirestore(userId, systemStatus, trackingData);
    const duration = Date.now() - startTime;
    logger.info('System status already determined, skipping onboarding', { 
      feature: 'TrackingService', 
      systemStatus, 
      duration 
    });
    return false;
  }
  
  // If no tracking data in Firestore, show onboarding
  if (!trackingData) {
    const duration = Date.now() - startTime;
    logger.info('No tracking data found, will show onboarding', { feature: 'TrackingService', duration });
    return true;
  }
  
  // If never prompted before, show onboarding
  if (!trackingData.lastTrackingPromptAt) {
    const duration = Date.now() - startTime;
    logger.info('Never prompted before, will show onboarding', { feature: 'TrackingService', duration });
    return true;
  }
  
  // Check if enough time has passed since last prompt
  const lastPromptDate = new Date(trackingData.lastTrackingPromptAt);
  const daysSinceLastPrompt = (Date.now() - lastPromptDate.getTime()) / (1000 * 60 * 60 * 24);
  const shouldShow = daysSinceLastPrompt >= DAYS_BETWEEN_TRACKING_PROMPTS;
  const duration = Date.now() - startTime;
  
  logger.info(`Last prompted ${daysSinceLastPrompt.toFixed(1)} days ago`, { 
    feature: 'TrackingService', 
    shouldShow, 
    duration 
  });
  
  return shouldShow;
}

/**
 * Check if app has Facebook attribution parameters in the URL
 * This helps decide if we should show the tracking prompt for first launches
 */
export function hasFacebookAttribution(attributionData?: {
  fbclid?: string | null;
  utm_source?: string | null;
}): boolean {
  return !!(attributionData?.fbclid || 
    (attributionData?.utm_source && attributionData.utm_source.toLowerCase().includes('facebook')));
}

/**
 * Request App Tracking Transparency permission
 * Returns the permission status
 */
export async function requestTrackingPermission(): Promise<TrackingPermissionStatus> {
  // On non-iOS platforms, we don't have ATT
  if (Platform.OS !== 'ios') {
    logger.info('Non-iOS platform, tracking permission is always authorized', { feature: 'TrackingService' });
    return 'authorized';
  }
  
  try {
    // Check current status first
    const currentStatus = await TrackingTransparency.getTrackingPermissionsAsync();
    
    if (currentStatus.status === 'granted') {
      return 'authorized';
    }
    
    // Request permission
    logger.info('Requesting tracking permission', { feature: 'TrackingService' });
    const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
    
    // Convert Expo status to our status type
    switch (status) {
      case 'granted': 
        logger.info('Tracking permission granted', { feature: 'TrackingService' });
        return 'authorized';
      case 'denied': 
        logger.info('Tracking permission denied', { feature: 'TrackingService' });
        return 'denied';
      // Expo's type is 'undetermined' (not 'unavailable')
      case 'undetermined': 
        logger.info('Tracking status undetermined on this device', { feature: 'TrackingService' });
        return 'not_determined';
      default: 
        logger.info('Tracking permission status not determined', { feature: 'TrackingService' });
        return 'not_determined';
    }
  } catch (error) {
    logger.error('Error requesting tracking permission', { feature: 'TrackingService', error });
    return 'not_determined';
  }
}

/**
 * Get current App Tracking Transparency permission status
 */
export async function getTrackingPermissionStatus(): Promise<TrackingPermissionStatus> {
  if (Platform.OS !== 'ios') {
    return 'authorized';
  }
  
  try {
    const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
    
    switch (status) {
      case 'granted': return 'authorized';
      case 'denied': return 'denied';
      case 'undetermined': return 'not_determined';
      default: return 'not_determined';
    }
  } catch (error) {
    logger.error('Error getting tracking permission status', { feature: 'TrackingService', error });
    return 'not_determined';
  }
}

/**
 * Sync the current system tracking status with Firestore
 * Call this when app comes to foreground to ensure data is up-to-date
 */
export async function syncTrackingStatusIfNeeded(userId: string): Promise<void> {
  try {
    logger.info('Syncing tracking status', { feature: 'TrackingService', userId });
    
    if (Platform.OS !== 'ios') {
      logger.info('Not iOS platform, no sync needed', { feature: 'TrackingService' });
      return;
    }
    
    const systemStatus = await getTrackingPermissionStatus();
    const trackingData = await getUserTrackingData(userId);
    
    await syncTrackingStatusWithFirestore(userId, systemStatus, trackingData);
    logger.info('Sync completed', { feature: 'TrackingService' });
  } catch (error) {
    logger.error('Error syncing tracking status', { feature: 'TrackingService', error });
  }
}

/**
 * Determines if we should show the tracking onboarding for first launch
 * This is separate from the user-based tracking to handle the case
 * where the app is freshly installed
 */
export async function shouldShowFirstLaunchTracking(): Promise<boolean> {
  // On non-iOS platforms, we don't show the ATT prompt
  if (Platform.OS !== 'ios') {
    logger.info('Not iOS platform, no need to show first launch tracking', { feature: 'TrackingService' });
    return false;
  }
  
  // Check if we've already shown the prompt
  const currentStatus = await TrackingTransparency.getTrackingPermissionsAsync();
  
  // If user has already made a choice, don't show again
  if (currentStatus.status === 'granted' || currentStatus.status === 'denied') {
    logger.info('User has already made tracking choice', { feature: 'TrackingService', status: currentStatus.status });
    return false;
  }
  
  logger.info('First launch tracking should be shown', { feature: 'TrackingService' });
  return true;
}
