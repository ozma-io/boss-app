import { db } from '@/constants/firebase.config';
import { Boss, BossUpdate, Unsubscribe } from '@/types';
import { retryWithBackoff } from '@/utils/retryWithBackoff';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { logger } from './logger.service';

/**
 * Check if error is related to offline state
 */
function isFirebaseOfflineError(error: Error): boolean {
  return (
    error.message.includes('client is offline') ||
    error.message.includes('Failed to get document') ||
    error.name === 'FirebaseError'
  );
}

/**
 * Get all bosses for a user
 * 
 * @param userId - User ID
 * @returns Array of bosses ordered by createdAt (oldest first)
 */
export async function getBosses(userId: string): Promise<Boss[]> {
  logger.time('getBosses');
  logger.debug('Getting bosses for user', { feature: 'BossService', userId });
  
  try {
    const result = await retryWithBackoff(async () => {
      const bossesRef = collection(db, 'users', userId, 'bosses');
      const q = query(bossesRef, orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      
      const bosses: Boss[] = [];
      snapshot.forEach((doc) => {
        bosses.push({
          id: doc.id,
          ...doc.data(),
        } as Boss);
      });
      
      return bosses;
    }, 3, 500);
    
    logger.timeEnd('getBosses', { feature: 'BossService', userId, count: result.length });
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    
    if (isOffline) {
      logger.warn('Failed to get bosses (offline), returning empty array', {
        feature: 'BossService',
        userId,
        retries: 3,
      });
    } else {
      logger.error('Error getting bosses', { feature: 'BossService', userId, error: err });
    }
    
    return [];
  }
}

/**
 * Get the first boss for a user (oldest by createdAt)
 * 
 * @param userId - User ID
 * @returns First boss or null if no bosses found
 */
export async function getFirstBoss(userId: string): Promise<Boss | null> {
  logger.time('getFirstBoss');
  logger.debug('Getting first boss for user', { feature: 'BossService', userId });
  
  try {
    const result = await retryWithBackoff(async () => {
      const bossesRef = collection(db, 'users', userId, 'bosses');
      const q = query(bossesRef, orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        logger.debug('No bosses found for user', { feature: 'BossService', userId });
        return null;
      }
      
      const firstDoc = snapshot.docs[0];
      return {
        id: firstDoc.id,
        ...firstDoc.data(),
      } as Boss;
    }, 3, 500);
    
    logger.timeEnd('getFirstBoss', { feature: 'BossService', userId, found: result !== null });
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    
    if (isOffline) {
      logger.warn('Failed to get first boss (offline), returning null', {
        feature: 'BossService',
        userId,
        retries: 3,
      });
    } else {
      logger.error('Error getting first boss', { feature: 'BossService', userId, error: err });
    }
    
    return null;
  }
}

/**
 * Get a specific boss by ID
 * 
 * @param userId - User ID
 * @param bossId - Boss ID
 * @returns Boss data or null if not found
 */
export async function getBoss(userId: string, bossId: string): Promise<Boss | null> {
  logger.time('getBoss');
  logger.debug('Getting boss', { feature: 'BossService', userId, bossId });
  
  try {
    const result = await retryWithBackoff(async () => {
      const bossRef = doc(db, 'users', userId, 'bosses', bossId);
      const bossDoc = await getDoc(bossRef);
      
      if (!bossDoc.exists()) {
        logger.debug('Boss does not exist', { feature: 'BossService', userId, bossId });
        return null;
      }
      
      return {
        id: bossDoc.id,
        ...bossDoc.data(),
      } as Boss;
    }, 3, 500);
    
    logger.timeEnd('getBoss', { feature: 'BossService', userId, bossId, found: result !== null });
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    
    if (isOffline) {
      logger.warn('Failed to get boss (offline), returning null', {
        feature: 'BossService',
        userId,
        bossId,
        retries: 3,
      });
    } else {
      logger.error('Error getting boss', { feature: 'BossService', userId, bossId, error: err });
    }
    
    return null;
  }
}

/**
 * Subscribe to real-time updates for a specific boss
 * 
 * @param userId - User ID
 * @param bossId - Boss ID
 * @param callback - Callback function called with boss data on updates
 * @returns Unsubscribe function to stop listening to updates
 */
export function subscribeToBoss(
  userId: string,
  bossId: string,
  callback: (boss: Boss | null) => void
): Unsubscribe {
  logger.debug('Subscribing to boss', { feature: 'BossService', userId, bossId });
  
  const bossRef = doc(db, 'users', userId, 'bosses', bossId);
  
  return onSnapshot(
    bossRef,
    (docSnapshot) => {
      if (docSnapshot.exists()) {
        const boss: Boss = {
          id: docSnapshot.id,
          ...docSnapshot.data(),
        } as Boss;
        logger.debug('Boss data updated', { feature: 'BossService', bossId });
        callback(boss);
      } else {
        logger.debug('Boss does not exist', { feature: 'BossService', bossId });
        callback(null);
      }
    },
    (error) => {
      logger.error('Error in boss subscription', { feature: 'BossService', bossId, error });
      callback(null);
    }
  );
}

/**
 * Create a new boss with minimal required data
 * 
 * @param userId - User ID
 * @returns Created boss ID
 */
export async function createBoss(userId: string): Promise<string> {
  try {
    logger.info('Creating new boss', { feature: 'BossService', userId });
    
    const bossesRef = collection(db, 'users', userId, 'bosses');
    const now = new Date().toISOString();
    
    const newBoss = {
      name: 'My Boss',
      position: 'Manager',
      birthday: '',
      managementStyle: '',
      startedAt: now,
      createdAt: now,
      updatedAt: now,
      _fieldsMeta: {},
    };
    
    const docRef = await addDoc(bossesRef, newBoss);
    
    logger.info('Successfully created boss', { feature: 'BossService', userId, bossId: docRef.id });
    return docRef.id;
  } catch (error) {
    const err = error as Error;
    logger.error('Error creating boss', { feature: 'BossService', userId, error: err });
    throw error;
  }
}

/**
 * Update boss data
 * 
 * @param userId - User ID
 * @param bossId - Boss ID
 * @param data - Partial boss data to update
 */
export async function updateBoss(
  userId: string,
  bossId: string,
  data: BossUpdate
): Promise<void> {
  try {
    logger.debug('Updating boss', { feature: 'BossService', userId, bossId });
    
    const bossRef = doc(db, 'users', userId, 'bosses', bossId);
    
    // Remove id from data if present (can't update document ID)
    const { id: _id, ...updateData } = data as Boss & { id?: string };
    
    await updateDoc(bossRef, {
      ...updateData,
      updatedAt: new Date().toISOString(),
    });
    
    logger.info('Successfully updated boss', { feature: 'BossService', userId, bossId });
  } catch (error) {
    const err = error as Error;
    logger.error('Error updating boss', { feature: 'BossService', userId, bossId, error: err });
    throw error;
  }
}

