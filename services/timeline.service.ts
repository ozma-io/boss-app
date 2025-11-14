import { db } from '@/constants/firebase.config';
import {
  FactEntry,
  NoteEntry,
  TimelineEntry,
  Unsubscribe
} from '@/types';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { logger } from './logger.service';

/**
 * Subscribe to real-time updates for timeline entries
 * 
 * Loads all timeline entries for the user and listens
 * for real-time changes. Entries are ordered by timestamp
 * (newest first).
 * 
 * @param userId - User ID
 * @param callback - Callback function called with entries array on updates
 * @returns Unsubscribe function to stop listening to updates
 */
export function subscribeToTimelineEntries(
  userId: string,
  callback: (entries: TimelineEntry[]) => void
): Unsubscribe {
  logger.debug('Subscribing to timeline entries', { feature: 'TimelineService', userId });
  
  const entriesRef = collection(db, 'users', userId, 'entries');
  const q = query(entriesRef, orderBy('timestamp', 'desc'));
  
  return onSnapshot(
    q,
    (snapshot) => {
      const entries: TimelineEntry[] = [];
      snapshot.forEach((doc) => {
        entries.push({
          id: doc.id,
          ...doc.data(),
        } as TimelineEntry);
      });
      
      logger.debug('Timeline entries updated', { feature: 'TimelineService', userId, count: entries.length });
      callback(entries);
    },
    (error) => {
      logger.error('Error in timeline subscription', { feature: 'TimelineService', userId, error });
      callback([]);
    }
  );
}

/**
 * Create a note entry in the timeline
 * 
 * @param userId - User ID
 * @param data - Note entry data (without id)
 * @returns Created entry ID
 */
export async function createNoteEntry(
  userId: string,
  data: Omit<NoteEntry, 'id'>
): Promise<string> {
  try {
    logger.debug('Creating note entry', { feature: 'TimelineService', userId, subtype: data.subtype });
    
    const entriesRef = collection(db, 'users', userId, 'entries');
    
    // TODO: Remove null filtering when icon picker is implemented
    // Filter out null/undefined values to avoid Firestore errors
    const entryData = {
      ...data,
      type: 'note' as const,
      timestamp: data.timestamp || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      // Remove icon if it's null or undefined
      ...(data.icon && { icon: data.icon }),
    };
    
    // Remove icon key completely if it's null
    if (entryData.icon === null || entryData.icon === undefined) {
      delete (entryData as any).icon;
    }
    
    const docRef = await addDoc(entriesRef, entryData);
    
    logger.info('Successfully created note entry', { feature: 'TimelineService', userId, entryId: docRef.id, subtype: data.subtype });
    return docRef.id;
  } catch (error) {
    const err = error as Error;
    logger.error('Error creating note entry', { feature: 'TimelineService', userId, error: err });
    throw error;
  }
}

/**
 * Create a fact entry in the timeline
 * 
 * @param userId - User ID
 * @param data - Fact entry data (without id)
 * @returns Created entry ID
 */
export async function createFactEntry(
  userId: string,
  data: Omit<FactEntry, 'id'>
): Promise<string> {
  try {
    logger.debug('Creating fact entry', { feature: 'TimelineService', userId, factKey: data.factKey });
    
    const entriesRef = collection(db, 'users', userId, 'entries');
    
    // TODO: Remove null filtering when icon picker is implemented
    // Filter out null/undefined values to avoid Firestore errors
    const entryData = {
      ...data,
      type: 'fact' as const,
      timestamp: data.timestamp || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      // Remove icon if it's null or undefined
      ...(data.icon && { icon: data.icon }),
    };
    
    // Remove icon key completely if it's null
    if (entryData.icon === null || entryData.icon === undefined) {
      delete (entryData as any).icon;
    }
    
    const docRef = await addDoc(entriesRef, entryData);
    
    logger.info('Successfully created fact entry', { feature: 'TimelineService', userId, entryId: docRef.id, factKey: data.factKey });
    return docRef.id;
  } catch (error) {
    const err = error as Error;
    logger.error('Error creating fact entry', { feature: 'TimelineService', userId, error: err });
    throw error;
  }
}

/**
 * Update a timeline entry
 * 
 * @param userId - User ID
 * @param entryId - Entry ID to update
 * @param updates - Partial entry data to update
 */
export async function updateTimelineEntry(
  userId: string,
  entryId: string,
  updates: Partial<Omit<TimelineEntry, 'id' | 'type'>>
): Promise<void> {
  try {
    logger.debug('Updating timeline entry', { feature: 'TimelineService', userId, entryId });
    
    // Filter out undefined values and convert null to deleteField()
    const cleanUpdates: any = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        // Skip undefined values - Firestore doesn't accept them
        continue;
      } else if (value === null) {
        // Convert null to deleteField() - semantic meaning is to remove the field
        cleanUpdates[key] = deleteField();
      } else {
        // All other values (including empty strings) are valid
        cleanUpdates[key] = value;
      }
    }
    
    const entryRef = doc(db, 'users', userId, 'entries', entryId);
    await updateDoc(entryRef, cleanUpdates);
    
    logger.info('Successfully updated timeline entry', { feature: 'TimelineService', userId, entryId });
  } catch (error) {
    const err = error as Error;
    logger.error('Error updating timeline entry', { feature: 'TimelineService', userId, entryId, error: err });
    throw error;
  }
}

/**
 * Delete a timeline entry
 * 
 * @param userId - User ID
 * @param entryId - Entry ID to delete
 */
export async function deleteTimelineEntry(
  userId: string,
  entryId: string
): Promise<void> {
  try {
    logger.debug('Deleting timeline entry', { feature: 'TimelineService', userId, entryId });
    
    const entryRef = doc(db, 'users', userId, 'entries', entryId);
    await deleteDoc(entryRef);
    
    logger.info('Successfully deleted timeline entry', { feature: 'TimelineService', userId, entryId });
  } catch (error) {
    const err = error as Error;
    logger.error('Error deleting timeline entry', { feature: 'TimelineService', userId, entryId, error: err });
    throw error;
  }
}

