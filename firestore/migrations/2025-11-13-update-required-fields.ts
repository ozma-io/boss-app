/**
 * Migration: Add Required Fields to User and Boss Documents
 * 
 * Date: 2025-11-13
 * Purpose: Add default values for new required fields
 * 
 * This migration:
 * 1. Adds name, goal, position to User documents if missing
 * 2. Adds birthday, managementStyle to Boss documents if missing
 * 3. Department remains in Boss documents (becomes optional, not removed)
 * 
 * Safe to run multiple times (idempotent).
 */

import { Firestore } from 'firebase-admin/firestore';

export const migration = {
  name: '2025-11-13-update-required-fields',
  description: 'Add default values for new required fields in User and Boss documents',
  date: '2025-11-13',
  author: 'system',
  
  async up(db: Firestore): Promise<void> {
    const batchSize = 500;
    let processedUsers = 0;
    let updatedUsers = 0;
    let processedBosses = 0;
    let updatedBosses = 0;
    
    console.log('📊 Starting migration: Update required fields');
    console.log('⏳ Fetching all users...\n');
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`Found ${usersSnapshot.size} users\n`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      processedUsers++;
      
      console.log(`👤 [${processedUsers}/${usersSnapshot.size}] Processing user: ${userId}`);
      
      // Check if User needs updates
      const userNeedsUpdate = !userData.name || !userData.goal || !userData.position;
      
      if (userNeedsUpdate) {
        const updates: any = {
          updatedAt: new Date().toISOString(),
        };
        
        if (!userData.name) {
          updates.name = '';
          console.log(`   + Adding name field`);
        }
        if (!userData.goal) {
          updates.goal = '';
          console.log(`   + Adding goal field`);
        }
        if (!userData.position) {
          updates.position = '';
          console.log(`   + Adding position field`);
        }
        
        await userDoc.ref.update(updates);
        updatedUsers++;
        console.log(`   ✓ Updated user document`);
      } else {
        console.log(`   ✓ User already has all required fields`);
      }
      
      // Get all bosses for this user
      const bossesRef = db.collection('users').doc(userId).collection('bosses');
      const bossesSnapshot = await bossesRef.get();
      
      if (bossesSnapshot.empty) {
        console.log(`   No bosses found, skipping`);
        continue;
      }
      
      console.log(`   Found ${bossesSnapshot.size} boss(es)`);
      
      // Process bosses in batches
      let batch = db.batch();
      let batchCount = 0;
      
      for (const bossDoc of bossesSnapshot.docs) {
        const bossData = bossDoc.data();
        const bossId = bossDoc.id;
        processedBosses++;
        
        // Check if Boss needs updates
        const bossNeedsUpdate = !bossData.birthday || !bossData.managementStyle;
        
        if (!bossNeedsUpdate) {
          console.log(`   📋 Boss ${bossId}: Already has all required fields`);
          continue;
        }
        
        const updates: any = {
          updatedAt: new Date().toISOString(),
        };
        
        if (!bossData.birthday) {
          updates.birthday = '';
          console.log(`   📝 Boss ${bossId}: Adding birthday field`);
        }
        if (!bossData.managementStyle) {
          updates.managementStyle = '';
          console.log(`   📝 Boss ${bossId}: Adding managementStyle field`);
        }
        
        batch.update(bossDoc.ref, updates);
        updatedBosses++;
        batchCount++;
        
        // Commit batch when it reaches the limit
        if (batchCount >= batchSize) {
          console.log(`   💾 Committing batch of ${batchCount} update(s)...`);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
      
      // Commit remaining updates for this user's bosses
      if (batchCount > 0) {
        console.log(`   💾 Committing final batch of ${batchCount} update(s)...`);
        await batch.commit();
      }
      
      console.log(''); // Empty line for readability
    }
    
    console.log('✅ Migration complete!\n');
    console.log('📊 Summary:');
    console.log(`   Users processed: ${processedUsers}`);
    console.log(`   Users updated: ${updatedUsers}`);
    console.log(`   Bosses processed: ${processedBosses}`);
    console.log(`   Bosses updated: ${updatedBosses}`);
  },
  
  /**
   * Rollback function
   * 
   * Warning: This removes the newly added required fields.
   * Only use if you need to completely undo the migration.
   */
  async down(db: Firestore): Promise<void> {
    console.log('⚠️  Rolling back migration: Removing new required fields');
    console.log('⏳ Fetching all users...\n');
    
    const usersSnapshot = await db.collection('users').get();
    let processedUsers = 0;
    let processedBosses = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      processedUsers++;
      console.log(`👤 Processing user: ${userId}`);
      
      // Note: We're only removing fields if they are empty strings
      // to avoid data loss for users who have already filled them in
      const userData = userDoc.data();
      const updates: any = {};
      
      if (userData.name === '') {
        updates.name = null;
      }
      if (userData.goal === '') {
        updates.goal = null;
      }
      if (userData.position === '') {
        updates.position = null;
      }
      
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date().toISOString();
        await userDoc.ref.update(updates);
        console.log(`   Removed empty fields from user`);
      }
      
      const bossesRef = db.collection('users').doc(userId).collection('bosses');
      const bossesSnapshot = await bossesRef.get();
      
      if (bossesSnapshot.empty) {
        continue;
      }
      
      const batch = db.batch();
      
      for (const bossDoc of bossesSnapshot.docs) {
        const bossData = bossDoc.data();
        const bossUpdates: any = {};
        
        if (bossData.birthday === '') {
          bossUpdates.birthday = null;
        }
        if (bossData.managementStyle === '') {
          bossUpdates.managementStyle = null;
        }
        
        if (Object.keys(bossUpdates).length > 0) {
          bossUpdates.updatedAt = new Date().toISOString();
          batch.update(bossDoc.ref, bossUpdates);
          processedBosses++;
        }
      }
      
      await batch.commit();
      console.log(`   Removed empty fields from ${bossesSnapshot.size} boss(es)`);
    }
    
    console.log(`\n✅ Rollback complete!`);
    console.log(`   Users processed: ${processedUsers}`);
    console.log(`   Bosses updated: ${processedBosses}`);
  },
};

