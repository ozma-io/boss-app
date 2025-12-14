import { db } from '@/constants/firebase.config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { logger } from './logger.service';

const ATTRIBUTION_STORAGE_KEY = '@boss_app_attribution_data';
const APP_INSTALL_EVENT_SENT_KEY = '@boss_app_install_event_sent';

export interface AttributionData {
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  email?: string | null;
  appUserId?: string | null;
  installedAt?: string;
}

/**
 * Save attribution data to AsyncStorage
 */
export async function saveAttributionData(data: AttributionData): Promise<void> {
  try {
    const attributionData: AttributionData = {
      ...data,
      installedAt: data.installedAt || new Date().toISOString(),
    };
    await AsyncStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attributionData));
    logger.info('Attribution data saved to AsyncStorage', { feature: 'AttributionService', attributionData });
  } catch (error) {
    logger.error('Error saving attribution data', { feature: 'AttributionService', error });
    throw error;
  }
}

/**
 * Get attribution data from AsyncStorage
 */
export async function getAttributionData(): Promise<AttributionData | null> {
  try {
    const data = await AsyncStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!data) {
      logger.debug('No attribution data found in AsyncStorage', { feature: 'AttributionService' });
      return null;
    }
    const parsedData = JSON.parse(data) as AttributionData;
    logger.debug('Attribution data retrieved from AsyncStorage', { feature: 'AttributionService', attributionData: parsedData });
    return parsedData;
  } catch (error) {
    logger.error('Error getting attribution data', { feature: 'AttributionService', error });
    return null;
  }
}

/**
 * Get attribution data with Firestore fallback
 * 
 * Strategy:
 * 1. Try AsyncStorage first (deep link params from mobile app install)
 *    - Avoids race condition with AuthContext writing to Firestore
 * 2. If AsyncStorage is empty OR missing fbc/fbp, fallback to Firestore
 *    - Handles Apple App Store case where deep link params are stripped
 *    - Retrieves fbc/fbp from web-funnel registration
 * 3. Preserve AsyncStorage data if Firestore returns null
 *    - Don't lose fbclid/UTM parameters when Firestore is empty
 * 
 * @param userId - User ID for Firestore lookup
 * @returns Attribution data from AsyncStorage or Firestore, null if neither has data
 */
export async function getAttributionDataWithFallback(userId: string): Promise<AttributionData | null> {
  try {
    // Try AsyncStorage first (deep link params from mobile app install)
    let attributionData = await getAttributionData();
    
    // Fallback to Firestore (web-funnel attribution when deep link params not available)
    if (!attributionData || (!attributionData.fbc && !attributionData.fbp)) {
      const { getUserAttributionFromFirestore } = await import('@/services/user.service');
      const firestoreAttribution = await getUserAttributionFromFirestore(userId);
      
      // Only use Firestore data if it exists, preserving AsyncStorage data otherwise
      if (firestoreAttribution) {
        attributionData = firestoreAttribution;
      }
    }
    
    return attributionData;
  } catch (error) {
    logger.error('Error getting attribution data with fallback', { feature: 'AttributionService', userId, error });
    return null;
  }
}

/**
 * Clear attribution data from AsyncStorage
 */
export async function clearAttributionData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
    logger.info('Attribution data cleared from AsyncStorage', { feature: 'AttributionService' });
  } catch (error) {
    logger.error('Error clearing attribution data', { feature: 'AttributionService', error });
    throw error;
  }
}

/**
 * Link attribution data to user document in Firestore
 * 
 * IMPORTANT: This function MERGES new attribution data with existing data
 * to preserve Facebook tracking data from web-funnel when user installs mobile app.
 */
export async function linkAttributionToUser(userId: string, attributionData: AttributionData): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', userId);
    
    // Get existing user document to preserve existing attribution data
    const existingUserDoc = await getDoc(userDocRef);
    const existingAttribution = existingUserDoc.exists() ? existingUserDoc.data()?.attribution || {} : {};
    
    // Filter out empty/null values from new attribution data to prevent overwriting good data
    const cleanAttributionData = Object.fromEntries(
      Object.entries(attributionData as Record<string, unknown>).filter(([_key, value]) => {
        const isEmpty = value === null || value === undefined || value === '';
        return !isEmpty; // Only keep non-empty values
      })
    ) as Partial<AttributionData>;
    
    // Merge attribution data (only clean new data takes priority for overlapping keys)
    const mergedAttribution = {
      ...existingAttribution,  // Keep existing Facebook/UTM data from web-funnel
      ...cleanAttributionData, // Add only non-empty new data from mobile app
    };
    
    await updateDoc(userDocRef, {
      attribution: mergedAttribution,
      updatedAt: new Date().toISOString(),
    });
    
    // Calculate filtered out data for logging
    const filteredOutKeys = Object.keys(attributionData).filter(key => {
      const value = (attributionData as Record<string, unknown>)[key];
      return value === null || value === undefined || value === '';
    });
    
    logger.info('Attribution data linked to user', { 
      feature: 'AttributionService', 
      userId,
      existingKeys: Object.keys(existingAttribution),
      rawNewKeys: Object.keys(attributionData),
      cleanNewKeys: Object.keys(cleanAttributionData),
      filteredOutKeys,
      mergedKeys: Object.keys(mergedAttribution),
      hadExistingData: Object.keys(existingAttribution).length > 0,
      filteredCount: filteredOutKeys.length
    });
  } catch (error) {
    logger.error('Error linking attribution to user', { feature: 'AttributionService', userId, error });
    throw error;
  }
}

/**
 * Extract attribution email if present (to pre-fill auth screen)
 */
export async function getAttributionEmail(): Promise<string | null> {
  try {
    const attributionData = await getAttributionData();
    return attributionData?.email || null;
  } catch (error) {
    logger.error('Error getting attribution email', { feature: 'AttributionService', error });
    return null;
  }
}

/**
 * Check if App Install event has been sent
 * 
 * Used to prevent duplicate App Install events (fb_mobile_activate_app).
 * This event should only be sent once per app installation.
 */
export async function isAppInstallEventSent(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(APP_INSTALL_EVENT_SENT_KEY);
    return value === 'true';
  } catch (error) {
    logger.error('Error checking app install event sent flag', { feature: 'AttributionService', error });
    return false;
  }
}

/**
 * Mark that App Install event has been sent
 * 
 * Sets a flag to prevent duplicate App Install events.
 * This should be called after successfully sending sendAppInstallEventDual.
 * 
 * Includes 5 retry attempts to handle transient AsyncStorage errors.
 */
export async function markAppInstallEventSent(): Promise<void> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await AsyncStorage.setItem(APP_INSTALL_EVENT_SENT_KEY, 'true');
      logger.info('Marked app install event as sent', { 
        feature: 'AttributionService',
        attempt,
        totalAttempts: 5
      });
      return;
    } catch (error) {
      lastError = error as Error;
      logger.debug('Failed to mark app install event as sent', {
        feature: 'AttributionService',
        attempt,
        totalAttempts: 5,
        error: lastError
      });
      
      if (attempt < 5) {
        // Wait with exponential backoff before retry
        const delayMs = 500 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  logger.error('Error marking app install event as sent after all retries', { 
    feature: 'AttributionService',
    attempts: 5,
    error: lastError 
  });
  throw lastError;
}

