/**
 * Example Migration: Rename Field
 * 
 * This example shows how to rename a field in existing documents.
 */

import { FieldValue, Firestore } from 'firebase-admin/firestore';

export const migration = {
  name: '2025-11-07-rename-boss-field',
  description: 'Rename "favoriteColor" to "preferredColor" in boss documents',
  date: '2025-11-07',
  author: 'your-name',
  
  async up(db: Firestore): Promise<void> {
    const batchSize = 500;
    let processedCount = 0;
    
    console.log('📊 Starting field rename migration...');
    
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`\n👤 Processing user: ${userId}`);
      
      const bossesRef = db.collection('users').doc(userId).collection('bosses');
      const bossesSnapshot = await bossesRef.get();
      
      let batch = db.batch();
      let batchCount = 0;
      
      for (const bossDoc of bossesSnapshot.docs) {
        const bossData = bossDoc.data();
        
        // Only process if old field exists
        if (!('favoriteColor' in bossData)) {
          continue;
        }
        
        const oldValue = bossData.favoriteColor;
        
        // Add new field and remove old field
        batch.update(bossDoc.ref, {
          preferredColor: oldValue,
          favoriteColor: FieldValue.delete(),
          updatedAt: new Date().toISOString(),
        });
        
        batchCount++;
        processedCount++;
        
        if (batchCount >= batchSize) {
          console.log(`  💾 Committing batch of ${batchCount} updates...`);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        console.log(`  💾 Committing final batch of ${batchCount} updates...`);
        await batch.commit();
      }
    }
    
    console.log(`\n✅ Migration complete. Updated ${processedCount} boss documents`);
  },
  
  async down(db: Firestore): Promise<void> {
    console.log('⚠️  Rolling back field rename...');
    
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const bossesRef = db.collection('users').doc(userDoc.id).collection('bosses');
      const bossesSnapshot = await bossesRef.get();
      
      const batch = db.batch();
      
      for (const bossDoc of bossesSnapshot.docs) {
        const bossData = bossDoc.data();
        
        if ('preferredColor' in bossData) {
          batch.update(bossDoc.ref, {
            favoriteColor: bossData.preferredColor,
            preferredColor: FieldValue.delete(),
          });
        }
      }
      
      await batch.commit();
    }
    
    console.log('✅ Rollback complete');
  },
};

