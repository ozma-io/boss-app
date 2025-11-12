import { db } from '@/constants/firebase.config';
import {
    InteractionEntry,
    NoteEntry,
    SurveyEntry,
    TimelineEntry,
    Unsubscribe,
} from '@/types';
import {
    addDoc,
    collection,
    onSnapshot,
    orderBy,
    query,
} from 'firebase/firestore';

/**
 * Subscribe to real-time updates for timeline entries
 * 
 * Loads all timeline entries for a specific boss and listens
 * for real-time changes. Entries are ordered by timestamp
 * (newest first).
 * 
 * @param userId - User ID
 * @param bossId - Boss ID
 * @param callback - Callback function called with entries array on updates
 * @returns Unsubscribe function to stop listening to updates
 */
export function subscribeToTimelineEntries(
  userId: string,
  bossId: string,
  callback: (entries: TimelineEntry[]) => void
): Unsubscribe {
  console.log(`📊 [TimelineService] >>> Subscribing to timeline entries for boss ${bossId}, user: ${userId}`);
  
  const entriesRef = collection(db, 'users', userId, 'bosses', bossId, 'entries');
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
      
      console.log(`📊 [TimelineService] Timeline entries updated: ${entries.length} entries`);
      callback(entries);
    },
    (error) => {
      console.error(`📊 [TimelineService] Error in timeline subscription:`, error);
      callback([]);
    }
  );
}

/**
 * Create a note entry in the timeline
 * 
 * @param userId - User ID
 * @param bossId - Boss ID
 * @param data - Note entry data (without id)
 * @returns Created entry ID
 */
export async function createNoteEntry(
  userId: string,
  bossId: string,
  data: Omit<NoteEntry, 'id'>
): Promise<string> {
  try {
    console.log(`📊 [TimelineService] >>> Creating note entry for boss ${bossId}`);
    
    const entriesRef = collection(db, 'users', userId, 'bosses', bossId, 'entries');
    
    const entryData = {
      ...data,
      type: 'note' as const,
      timestamp: data.timestamp || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    
    const docRef = await addDoc(entriesRef, entryData);
    
    console.log(`📊 [TimelineService] <<< Successfully created note entry: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    const err = error as Error;
    console.error(`📊 [TimelineService] Error creating note entry:`, err.message);
    throw error;
  }
}

/**
 * Create an interaction entry in the timeline
 * 
 * @param userId - User ID
 * @param bossId - Boss ID
 * @param data - Interaction entry data (without id)
 * @returns Created entry ID
 */
export async function createInteractionEntry(
  userId: string,
  bossId: string,
  data: Omit<InteractionEntry, 'id'>
): Promise<string> {
  try {
    console.log(`📊 [TimelineService] >>> Creating interaction entry for boss ${bossId}`);
    
    const entriesRef = collection(db, 'users', userId, 'bosses', bossId, 'entries');
    
    const entryData = {
      ...data,
      type: 'interaction' as const,
      timestamp: data.timestamp || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    
    const docRef = await addDoc(entriesRef, entryData);
    
    console.log(`📊 [TimelineService] <<< Successfully created interaction entry: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    const err = error as Error;
    console.error(`📊 [TimelineService] Error creating interaction entry:`, err.message);
    throw error;
  }
}

/**
 * Create a survey entry in the timeline
 * 
 * @param userId - User ID
 * @param bossId - Boss ID
 * @param data - Survey entry data (without id)
 * @returns Created entry ID
 */
export async function createSurveyEntry(
  userId: string,
  bossId: string,
  data: Omit<SurveyEntry, 'id'>
): Promise<string> {
  try {
    console.log(`📊 [TimelineService] >>> Creating survey entry for boss ${bossId}`);
    
    const entriesRef = collection(db, 'users', userId, 'bosses', bossId, 'entries');
    
    const entryData = {
      ...data,
      type: 'survey' as const,
      timestamp: data.timestamp || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    
    const docRef = await addDoc(entriesRef, entryData);
    
    console.log(`📊 [TimelineService] <<< Successfully created survey entry: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    const err = error as Error;
    console.error(`📊 [TimelineService] Error creating survey entry:`, err.message);
    throw error;
  }
}

