/**
 * Migration: Move Timeline Entries from Boss Subcollection to User Level
 * 
 * Date: 2025-11-14
 * Purpose: Migrate all timeline entries from /users/{userId}/bosses/{bossId}/entries
 *          to /users/{userId}/entries, removing boss dependency
 * 
 * This migration:
 * 1. Scans all users and their bosses
 * 2. Copies each entry from boss subcollection to user level
 * 3. Preserves all entry fields exactly as they are
 * 4. Does NOT add bossId field (entries no longer need boss association)
 * 5. Tracks copied entries to avoid duplicates
 * 6. Deletes old entries after successful copy
 * 
 * Safe to run multiple times (idempotent).
 */

import { Firestore } from 'firebase-admin/firestore';

export const migration = {
  name: '2025-11-14-move-entries-to-user-level',
  description: 'Move timeline entries from boss subcollection to user level',
  date: '2025-11-14',
  author: 'system',
  
  async up(db: Firestore): Promise<void> {
    const batchSize = 500;
    let processedUsers = 0;
    let processedBosses = 0;
    let copiedEntries = 0;
    let skippedEntries = 0;
    let deletedOldEntries = 0;
    
    console.log('📊 Starting migration: Move entries to user level');
    console.log('⏳ Fetching all users...\n');
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`Found ${usersSnapshot.size} users\n`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      processedUsers++;
      
      console.log(`👤 [${processedUsers}/${usersSnapshot.size}] Processing user: ${userId}`);
      
      // Get user-level entries collection reference
      const userEntriesRef = db.collection('users').doc(userId).collection('entries');
      
      // Get all existing user-level entries to check for duplicates
      const existingEntriesSnapshot = await userEntriesRef.get();
      const existingEntryIds = new Set(existingEntriesSnapshot.docs.map(doc => doc.id));
      
      console.log(`   Found ${existingEntryIds.size} existing entries at user level`);
      
      // Get all bosses for this user
      const bossesRef = db.collection('users').doc(userId).collection('bosses');
      const bossesSnapshot = await bossesRef.get();
      
      if (bossesSnapshot.empty) {
        console.log(`   No bosses found, skipping`);
        console.log('');
        continue;
      }
      
      console.log(`   Found ${bossesSnapshot.size} boss(es)`);
      
      // Process each boss
      for (const bossDoc of bossesSnapshot.docs) {
        const bossId = bossDoc.id;
        processedBosses++;
        
        console.log(`   📋 Processing boss: ${bossId}`);
        
        // Get all entries for this boss
        const bossEntriesRef = bossesRef.doc(bossId).collection('entries');
        const bossEntriesSnapshot = await bossEntriesRef.get();
        
        if (bossEntriesSnapshot.empty) {
          console.log(`      No entries found for this boss`);
          continue;
        }
        
        console.log(`      Found ${bossEntriesSnapshot.size} entries`);
        
        // Copy entries in batches
        let copyBatch = db.batch();
        let copyBatchCount = 0;
        let deleteBatch = db.batch();
        let deleteBatchCount = 0;
        const entriesToDelete: FirebaseFirestore.DocumentReference[] = [];
        
        for (const entryDoc of bossEntriesSnapshot.docs) {
          const entryId = entryDoc.id;
          const entryData = entryDoc.data();
          
          // Check if entry already exists at user level
          if (existingEntryIds.has(entryId)) {
            console.log(`      ⏭️  Entry ${entryId} already exists at user level, skipping`);
            skippedEntries++;
            // Still mark for deletion from old location
            entriesToDelete.push(entryDoc.ref);
            continue;
          }
          
          // Copy entry to user level (preserve all fields, no bossId added)
          const userEntryRef = userEntriesRef.doc(entryId);
          copyBatch.set(userEntryRef, entryData);
          copyBatchCount++;
          copiedEntries++;
          
          // Mark for deletion from old location
          entriesToDelete.push(entryDoc.ref);
          
          // Commit copy batch when it reaches the limit
          if (copyBatchCount >= batchSize) {
            console.log(`      💾 Committing copy batch of ${copyBatchCount} entries...`);
            await copyBatch.commit();
            copyBatch = db.batch();
            copyBatchCount = 0;
          }
        }
        
        // Commit remaining copy operations
        if (copyBatchCount > 0) {
          console.log(`      💾 Committing final copy batch of ${copyBatchCount} entries...`);
          await copyBatch.commit();
        }
        
        // Delete old entries after successful copy
        console.log(`      🗑️  Deleting ${entriesToDelete.length} old entries from boss subcollection...`);
        
        for (const entryRef of entriesToDelete) {
          deleteBatch.delete(entryRef);
          deleteBatchCount++;
          deletedOldEntries++;
          
          // Commit delete batch when it reaches the limit
          if (deleteBatchCount >= batchSize) {
            await deleteBatch.commit();
            deleteBatch = db.batch();
            deleteBatchCount = 0;
          }
        }
        
        // Commit remaining delete operations
        if (deleteBatchCount > 0) {
          await deleteBatch.commit();
        }
        
        console.log(`      ✅ Boss ${bossId}: Migrated ${bossEntriesSnapshot.size} entries`);
      }
      
      console.log(''); // Empty line for readability
    }
    
    console.log('✅ Migration complete!\n');
    console.log('📊 Summary:');
    console.log(`   Users processed: ${processedUsers}`);
    console.log(`   Bosses processed: ${processedBosses}`);
    console.log(`   Entries copied: ${copiedEntries}`);
    console.log(`   Entries skipped (already existed): ${skippedEntries}`);
    console.log(`   Old entries deleted: ${deletedOldEntries}`);
    console.log(`   Total entries migrated: ${copiedEntries + skippedEntries}`);
  },
  
  /**
   * Rollback function
   * 
   * Warning: This moves entries back from user level to boss subcollections.
   * This requires knowledge of which boss each entry belonged to, which we don't store.
   * 
   * This rollback is intentionally NOT implemented because:
   * 1. Entries have no bossId field, so we can't determine which boss they belong to
   * 2. The migration is designed to be one-way
   * 3. Code changes must be rolled back simultaneously with data
   * 
   * To rollback:
   * 1. Restore from Firestore backup
   * 2. Revert code changes
   * 3. Redeploy application
   */
  async down(db: Firestore): Promise<void> {
    console.log('❌ Rollback not supported for this migration');
    console.log('');
    console.log('Entries no longer have bossId field, so we cannot determine');
    console.log('which boss subcollection they should be moved back to.');
    console.log('');
    console.log('To rollback this migration:');
    console.log('1. Restore Firestore from backup taken before migration');
    console.log('2. Revert code changes to previous commit');
    console.log('3. Redeploy application');
    console.log('');
    throw new Error('Rollback not supported - restore from backup instead');
  },
};

