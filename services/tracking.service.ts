import { db } from '@/constants/firebase.config';
import { setAmplitudeUserProperties, trackAmplitudeEvent } from '@/services/amplitude.service';
import { retryWithBackoff } from '@/utils/retryWithBackoff';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
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
  console.log(`📊 [TrackingService] >>> Getting tracking data for user: ${userId} at ${new Date().toISOString()}`);
  
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
    console.log(`📊 [TrackingService] <<< Successfully retrieved tracking data in ${duration}ms`);
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    const duration = Date.now() - startTime;
    
    if (isOffline) {
      console.warn(
        `📊 [TrackingService] Failed to get user tracking data after 3 retries (offline) in ${duration}ms. User: ${userId}. Defaulting to null.`
      );
    } else {
      console.error(
        `📊 [TrackingService] Error getting user tracking data for ${userId} after ${duration}ms:`,
        err.message
      );
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
    
    if (userDoc.exists()) {
      const existingHistory = userDoc.data().trackingPromptHistory || [];
      const existingCount = userDoc.data().trackingPromptCount || 0;
      
      await updateDoc(userDocRef, {
        trackingPermissionStatus: status,
        lastTrackingPromptAt: new Date().toISOString(),
        trackingPromptHistory: [...existingHistory, historyItem],
        trackingPromptCount: existingCount + 1
      });
    } else {
      await setDoc(userDocRef, {
        trackingPermissionStatus: status,
        lastTrackingPromptAt: new Date().toISOString(),
        trackingPromptHistory: [historyItem],
        trackingPromptCount: 1
      });
    }
    
    // Track event in Amplitude
    trackAmplitudeEvent('tracking_permission_responded', {
      status: status,
      platform: Platform.OS,
    });
    
    // Set user property in Amplitude
    await setAmplitudeUserProperties({
      tracking_permission_status: status,
    });
    
    console.log('[TrackingService] Tracking permission status updated and tracked in Amplitude:', status);
  } catch (error) {
    console.error('[TrackingService] Error updating tracking permission status:', error);
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
    
    if (userDoc.exists()) {
      const existingHistory = userDoc.data().trackingPromptHistory || [];
      const existingCount = userDoc.data().trackingPromptCount || 0;
      
      await updateDoc(userDocRef, {
        lastTrackingPromptAt: new Date().toISOString(),
        trackingPromptHistory: [...existingHistory, historyItem],
        trackingPromptCount: existingCount + 1
      });
    } else {
      await setDoc(userDocRef, {
        trackingPermissionStatus: 'not_determined',
        lastTrackingPromptAt: new Date().toISOString(),
        trackingPromptHistory: [historyItem],
        trackingPromptCount: 1
      });
    }
  } catch (error) {
    console.error('[TrackingService] Error recording tracking prompt shown:', error);
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
    console.log(`📊 [TrackingService] Firestore already in sync with system status: ${systemStatus}`);
    return;
  }
  
  console.log(
    `📊 [TrackingService] Syncing status - System: ${systemStatus}, ` +
    `Firestore: ${firestoreData?.trackingPermissionStatus || 'null'}`
  );
  
  try {
    await updateTrackingPermissionStatus(userId, systemStatus);
    console.log(`📊 [TrackingService] Successfully synced tracking status to Firestore`);
  } catch (error) {
    console.error('[TrackingService] Failed to sync tracking status to Firestore:', error);
  }
}

/**
 * Check if the tracking onboarding should be shown to the user
 * This checks permission status and time since last prompt
 */
export async function shouldShowTrackingOnboarding(userId: string): Promise<boolean> {
  const startTime = Date.now();
  console.log(`📊 [TrackingService] >>> Checking if should show tracking onboarding for user: ${userId}`);
  
  // First, check if ATT is available (iOS 14+)
  if (Platform.OS !== 'ios') {
    const duration = Date.now() - startTime;
    console.log(`📊 [TrackingService] <<< Not iOS platform, no need for ATT onboarding (${duration}ms)`);
    return false;
  }
  
  // Check current system status first
  const systemStatus = await getTrackingPermissionStatus();
  console.log(`📊 [TrackingService] Current system tracking status: ${systemStatus}`);
  
  // Get Firestore data
  const trackingData = await getUserTrackingData(userId);
  
  // If system has already determined status (granted or denied), sync with Firestore and don't show onboarding
  if (systemStatus === 'authorized' || systemStatus === 'denied') {
    await syncTrackingStatusWithFirestore(userId, systemStatus, trackingData);
    const duration = Date.now() - startTime;
    console.log(
      `📊 [TrackingService] <<< System status already determined (${systemStatus}), ` +
      `skipping onboarding (${duration}ms)`
    );
    return false;
  }
  
  // If no tracking data in Firestore, show onboarding
  if (!trackingData) {
    const duration = Date.now() - startTime;
    console.log(`📊 [TrackingService] <<< No tracking data found, will show onboarding (${duration}ms)`);
    return true;
  }
  
  // If never prompted before, show onboarding
  if (!trackingData.lastTrackingPromptAt) {
    const duration = Date.now() - startTime;
    console.log(`📊 [TrackingService] <<< Never prompted before, will show onboarding (${duration}ms)`);
    return true;
  }
  
  // Check if enough time has passed since last prompt
  const lastPromptDate = new Date(trackingData.lastTrackingPromptAt);
  const daysSinceLastPrompt = (Date.now() - lastPromptDate.getTime()) / (1000 * 60 * 60 * 24);
  const shouldShow = daysSinceLastPrompt >= DAYS_BETWEEN_TRACKING_PROMPTS;
  const duration = Date.now() - startTime;
  
  console.log(
    `📊 [TrackingService] <<< Last prompted ${daysSinceLastPrompt.toFixed(1)} days ago, ` +
    `${shouldShow ? 'will show' : 'will skip'} onboarding (${duration}ms)`
  );
  
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
    console.log('[TrackingService] Non-iOS platform, tracking permission is always authorized');
    return 'authorized';
  }
  
  try {
    // Check current status first
    const currentStatus = await TrackingTransparency.getTrackingPermissionsAsync();
    
    if (currentStatus.status === 'granted') {
      return 'authorized';
    }
    
    // Request permission
    console.log('[TrackingService] Requesting tracking permission');
    const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
    
    // Convert Expo status to our status type
    switch (status) {
      case 'granted': 
        console.log('[TrackingService] Tracking permission granted');
        return 'authorized';
      case 'denied': 
        console.log('[TrackingService] Tracking permission denied');
        return 'denied';
      // Expo's type is 'undetermined' (not 'unavailable')
      case 'undetermined': 
        console.log('[TrackingService] Tracking status undetermined on this device');
        return 'not_determined';
      default: 
        console.log('[TrackingService] Tracking permission status not determined');
        return 'not_determined';
    }
  } catch (error) {
    console.error('[TrackingService] Error requesting tracking permission:', error);
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
    console.error('[TrackingService] Error getting tracking permission status:', error);
    return 'not_determined';
  }
}

/**
 * Sync the current system tracking status with Firestore
 * Call this when app comes to foreground to ensure data is up-to-date
 */
export async function syncTrackingStatusIfNeeded(userId: string): Promise<void> {
  try {
    console.log(`📊 [TrackingService] >>> Syncing tracking status for user: ${userId}`);
    
    if (Platform.OS !== 'ios') {
      console.log(`📊 [TrackingService] <<< Not iOS platform, no sync needed`);
      return;
    }
    
    const systemStatus = await getTrackingPermissionStatus();
    const trackingData = await getUserTrackingData(userId);
    
    await syncTrackingStatusWithFirestore(userId, systemStatus, trackingData);
    console.log(`📊 [TrackingService] <<< Sync completed`);
  } catch (error) {
    console.error('[TrackingService] Error syncing tracking status:', error);
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
    console.log('[TrackingService] Not iOS platform, no need to show first launch tracking');
    return false;
  }
  
  // Check if we've already shown the prompt
  const currentStatus = await TrackingTransparency.getTrackingPermissionsAsync();
  
  // If user has already made a choice, don't show again
  if (currentStatus.status === 'granted' || currentStatus.status === 'denied') {
    console.log('[TrackingService] User has already made tracking choice:', currentStatus.status);
    return false;
  }
  
  console.log('[TrackingService] First launch tracking should be shown');
  return true;
}
