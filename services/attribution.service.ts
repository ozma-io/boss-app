import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/constants/firebase.config';
import { doc, updateDoc } from 'firebase/firestore';
import { logger } from './logger.service';

const ATTRIBUTION_STORAGE_KEY = '@boss_app_attribution_data';
const FIRST_LAUNCH_KEY = '@boss_app_first_launch';

export interface AttributionData {
  fbclid?: string | null;
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
 */
export async function linkAttributionToUser(userId: string, attributionData: AttributionData): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      attribution: attributionData,
      updatedAt: new Date().toISOString(),
    });
    logger.info('Attribution data linked to user', { feature: 'AttributionService', userId, attributionData });
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

