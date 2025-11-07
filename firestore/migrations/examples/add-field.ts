/**
 * Example Migration: Add New Field
 * 
 * This example shows how to add a new field to existing documents.
 * Use this pattern when you need to backfill data for existing records.
 */

import { FieldValue, Firestore } from 'firebase-admin/firestore';

export const migration = {
  name: '2025-11-07-add-boss-avatar-url',
  description: 'Add avatarUrl field to all boss documents',
  date: '2025-11-07',
  author: 'your-name',
  
  async up(db: Firestore): Promise<void> {
    const batchSize = 500;
    let processedCount = 0;
    
    console.log('📊 Fetching all users...');
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`Found ${usersSnapshot.size} users`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`\n👤 Processing user: ${userId}`);
      
      // Get all bosses for this user
      const bossesRef = db.collection('users').doc(userId).collection('bosses');
      const bossesSnapshot = await bossesRef.get();
      
      console.log(`  Found ${bossesSnapshot.size} bosses`);
      
      // Process in batches
      let batch = db.batch();
      let batchCount = 0;
      
      for (const bossDoc of bossesSnapshot.docs) {
        const bossData = bossDoc.data();
        
        // Skip if field already exists
        if ('avatarUrl' in bossData) {
          console.log(`  ⏭️  Boss ${bossDoc.id} already has avatarUrl, skipping`);
          continue;
        }
        
        // Add the new field
        batch.update(bossDoc.ref, {
          avatarUrl: null, // Default value
          updatedAt: new Date().toISOString(),
        });
        
        batchCount++;
        processedCount++;
        
        // Commit batch when it reaches the limit
        if (batchCount >= batchSize) {
          console.log(`  💾 Committing batch of ${batchCount} updates...`);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
      
      // Commit remaining updates
      if (batchCount > 0) {
        console.log(`  💾 Committing final batch of ${batchCount} updates...`);
        await batch.commit();
      }
    }
    
    console.log(`\n✅ Migration complete. Updated ${processedCount} boss documents`);
  },
  
  // Optional: Rollback function
  async down(db: Firestore): Promise<void> {
    console.log('⚠️  Rolling back migration...');
    
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const bossesRef = db.collection('users').doc(userDoc.id).collection('bosses');
      const bossesSnapshot = await bossesRef.get();
      
      const batch = db.batch();
      
      for (const bossDoc of bossesSnapshot.docs) {
        batch.update(bossDoc.ref, {
          avatarUrl: FieldValue.delete(),
        });
      }
      
      await batch.commit();
    }
    
    console.log('✅ Rollback complete');
  },
};

