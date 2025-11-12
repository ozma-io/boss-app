import { db } from '@/constants/firebase.config';
import { Boss, Unsubscribe } from '@/types';
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
  const startTime = Date.now();
  console.log(`📊 [BossService] >>> Getting bosses for user: ${userId} at ${new Date().toISOString()}`);
  
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
    
    const duration = Date.now() - startTime;
    console.log(`📊 [BossService] <<< Successfully retrieved ${result.length} boss(es) in ${duration}ms`);
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    const duration = Date.now() - startTime;
    
    if (isOffline) {
      console.warn(
        `📊 [BossService] Failed to get bosses after 3 retries (offline) in ${duration}ms. User: ${userId}. Returning empty array.`
      );
    } else {
      console.error(
        `📊 [BossService] Error getting bosses for ${userId} after ${duration}ms:`,
        err.message
      );
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
  const startTime = Date.now();
  console.log(`📊 [BossService] >>> Getting first boss for user: ${userId} at ${new Date().toISOString()}`);
  
  try {
    const result = await retryWithBackoff(async () => {
      const bossesRef = collection(db, 'users', userId, 'bosses');
      const q = query(bossesRef, orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log(`📊 [BossService] No bosses found for user: ${userId}`);
        return null;
      }
      
      const firstDoc = snapshot.docs[0];
      return {
        id: firstDoc.id,
        ...firstDoc.data(),
      } as Boss;
    }, 3, 500);
    
    const duration = Date.now() - startTime;
    console.log(`📊 [BossService] <<< Successfully retrieved first boss in ${duration}ms`);
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    const duration = Date.now() - startTime;
    
    if (isOffline) {
      console.warn(
        `📊 [BossService] Failed to get first boss after 3 retries (offline) in ${duration}ms. User: ${userId}. Returning null.`
      );
    } else {
      console.error(
        `📊 [BossService] Error getting first boss for ${userId} after ${duration}ms:`,
        err.message
      );
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
  const startTime = Date.now();
  console.log(`📊 [BossService] >>> Getting boss ${bossId} for user: ${userId} at ${new Date().toISOString()}`);
  
  try {
    const result = await retryWithBackoff(async () => {
      const bossRef = doc(db, 'users', userId, 'bosses', bossId);
      const bossDoc = await getDoc(bossRef);
      
      if (!bossDoc.exists()) {
        console.log(`📊 [BossService] Boss ${bossId} does not exist for user: ${userId}`);
        return null;
      }
      
      return {
        id: bossDoc.id,
        ...bossDoc.data(),
      } as Boss;
    }, 3, 500);
    
    const duration = Date.now() - startTime;
    console.log(`📊 [BossService] <<< Successfully retrieved boss in ${duration}ms`);
    return result;
  } catch (error) {
    const err = error as Error;
    const isOffline = isFirebaseOfflineError(err);
    const duration = Date.now() - startTime;
    
    if (isOffline) {
      console.warn(
        `📊 [BossService] Failed to get boss after 3 retries (offline) in ${duration}ms. User: ${userId}, Boss: ${bossId}. Returning null.`
      );
    } else {
      console.error(
        `📊 [BossService] Error getting boss ${bossId} for ${userId} after ${duration}ms:`,
        err.message
      );
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
  console.log(`📊 [BossService] >>> Subscribing to boss ${bossId} for user: ${userId}`);
  
  const bossRef = doc(db, 'users', userId, 'bosses', bossId);
  
  return onSnapshot(
    bossRef,
    (docSnapshot) => {
      if (docSnapshot.exists()) {
        const boss: Boss = {
          id: docSnapshot.id,
          ...docSnapshot.data(),
        } as Boss;
        console.log(`📊 [BossService] Boss data updated for ${bossId}`);
        callback(boss);
      } else {
        console.log(`📊 [BossService] Boss ${bossId} does not exist`);
        callback(null);
      }
    },
    (error) => {
      console.error(`📊 [BossService] Error in boss subscription for ${bossId}:`, error);
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
    console.log(`📊 [BossService] >>> Creating new boss for user: ${userId}`);
    
    const bossesRef = collection(db, 'users', userId, 'bosses');
    const now = new Date().toISOString();
    
    const newBoss = {
      name: 'My Boss',
      position: 'Manager',
      department: 'Company',
      startedAt: now,
      createdAt: now,
      updatedAt: now,
      _fieldsMeta: {},
    };
    
    const docRef = await addDoc(bossesRef, newBoss);
    
    console.log(`📊 [BossService] <<< Successfully created boss: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    const err = error as Error;
    console.error(`📊 [BossService] Error creating boss:`, err.message);
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
  data: Partial<Boss>
): Promise<void> {
  try {
    console.log(`📊 [BossService] >>> Updating boss ${bossId} for user: ${userId}`);
    
    const bossRef = doc(db, 'users', userId, 'bosses', bossId);
    
    // Remove id from data if present (can't update document ID)
    const { id, ...updateData } = data as Boss & { id?: string };
    
    await updateDoc(bossRef, {
      ...updateData,
      updatedAt: new Date().toISOString(),
    });
    
    console.log(`📊 [BossService] <<< Successfully updated boss ${bossId}`);
  } catch (error) {
    const err = error as Error;
    console.error(`📊 [BossService] Error updating boss ${bossId}:`, err.message);
    throw error;
  }
}

