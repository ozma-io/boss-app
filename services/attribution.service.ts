import { db } from '@/constants/firebase.config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { logger } from './logger.service';

const ATTRIBUTION_STORAGE_KEY = '@boss_app_attribution_data';
const FIRST_LAUNCH_KEY = '@boss_app_first_launch';
const NEEDS_TRACKING_AFTER_AUTH_KEY = '@boss_app_needs_tracking_after_auth';

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
 * Check if this is the first launch of the app
 */
export async function isFirstLaunch(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    return value === null;
  } catch (error) {
    logger.error('Error checking first launch', { feature: 'AttributionService', error });
    return false;
  }
}

/**
 * Mark that the app has been launched
 */
export async function markAppAsLaunched(): Promise<void> {
  try {
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true');
    logger.info('App marked as launched', { feature: 'AttributionService' });
  } catch (error) {
    logger.error('Error marking app as launched', { feature: 'AttributionService', error });
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
 * Set flag that user needs tracking after authentication (MAIN FLOW)
 * 
 * This is used for organic users who install the app without Facebook attribution.
 * We wait for them to log in, then show tracking onboarding and send events with email.
 * 
 * @param value - true if user needs tracking after auth, false otherwise
 */
export async function setNeedsTrackingAfterAuth(value: boolean): Promise<void> {
  try {
    if (value) {
      await AsyncStorage.setItem(NEEDS_TRACKING_AFTER_AUTH_KEY, 'true');
      logger.info('Set needs tracking after auth flag', { feature: 'AttributionService' });
    } else {
      await AsyncStorage.removeItem(NEEDS_TRACKING_AFTER_AUTH_KEY);
      logger.info('Cleared needs tracking after auth flag', { feature: 'AttributionService' });
    }
  } catch (error) {
    logger.error('Error setting needs tracking after auth', { feature: 'AttributionService', error });
    throw error;
  }
}

/**
 * Check if user needs tracking after authentication (MAIN FLOW)
 * 
 * Returns true if this is an organic user who needs to be prompted for tracking
 * after they log in with their email.
 * 
 * @returns true if tracking should be shown after login
 */
export async function needsTrackingAfterAuth(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(NEEDS_TRACKING_AFTER_AUTH_KEY);
    return value === 'true';
  } catch (error) {
    logger.error('Error checking needs tracking after auth', { feature: 'AttributionService', error });
    return false;
  }
}

/**
 * Clear the tracking after auth flag (MAIN FLOW)
 * 
 * Called after tracking has been completed for organic users.
 */
export async function clearTrackingAfterAuth(): Promise<void> {
  try {
    await AsyncStorage.removeItem(NEEDS_TRACKING_AFTER_AUTH_KEY);
    logger.info('Cleared tracking after auth flag', { feature: 'AttributionService' });
  } catch (error) {
    logger.error('Error clearing tracking after auth', { feature: 'AttributionService', error });
    throw error;
  }
}

