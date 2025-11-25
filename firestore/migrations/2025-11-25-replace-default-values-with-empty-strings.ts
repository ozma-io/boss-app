/**
 * Migration: Replace Default Values with Empty Strings
 * 
 * Date: 2025-11-25
 * Purpose: Replace old hardcoded default values with empty strings
 * 
 * This migration:
 * 1. Replaces "My Boss" with "" in boss.name fields
 * 2. Replaces "Manager" with "" in boss.position fields  
 * 3. Replaces "Unknown" with "" in boss.managementStyle fields
 * 4. Replaces "User" with "" in user.displayName fields (if exactly "User")
 * 
 * Safe to run multiple times (idempotent).
 */

import { Firestore } from 'firebase-admin/firestore';

export const migration = {
  name: '2025-11-25-replace-default-values-with-empty-strings',
  description: 'Replace old hardcoded default values with empty strings for better UX',
  date: '2025-11-25',
  author: 'system',
  
  async up(db: Firestore): Promise<void> {
    const batchSize = 500;
    let processedUsers = 0;
    let updatedUsers = 0;
    let processedBosses = 0;
    let updatedBosses = 0;
    
    console.log('📊 Starting migration: Replace default values with empty strings');
    console.log('⏳ Fetching all users...\n');
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`Found ${usersSnapshot.size} users\n`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      processedUsers++;
      
      console.log(`👤 [${processedUsers}/${usersSnapshot.size}] Processing user: ${userId}`);
      
      // Check if User needs updates (displayName = "User")
      const userNeedsUpdate = userData.displayName === 'User';
      
      if (userNeedsUpdate) {
        const updates: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
          displayName: '',
          updatedAt: new Date().toISOString(),
        };
        
        await userDoc.ref.update(updates);
        updatedUsers++;
        console.log(`   ✓ Updated user displayName: "User" → ""`);
      } else {
        console.log(`   ✓ User displayName doesn't need update (current: "${userData.displayName || 'undefined'}")`);
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
        
        // Check which fields need updates
        const updates: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
        let needsUpdate = false;
        
        if (bossData.name === 'My Boss') {
          updates.name = '';
          needsUpdate = true;
          console.log(`   📝 Boss ${bossId}: name "My Boss" → ""`);
        }
        
        if (bossData.position === 'Manager') {
          updates.position = '';
          needsUpdate = true;
          console.log(`   📝 Boss ${bossId}: position "Manager" → ""`);
        }
        
        if (bossData.managementStyle === 'Unknown') {
          updates.managementStyle = '';
          needsUpdate = true;
          console.log(`   📝 Boss ${bossId}: managementStyle "Unknown" → ""`);
        }
        
        if (!needsUpdate) {
          console.log(`   📋 Boss ${bossId}: No default values to replace`);
          console.log(`      name: "${bossData.name || 'undefined'}"`);
          console.log(`      position: "${bossData.position || 'undefined'}"`);
          console.log(`      managementStyle: "${bossData.managementStyle || 'undefined'}"`);
          continue;
        }
        
        updates.updatedAt = new Date().toISOString();
        
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
   * Warning: This restores the old default values.
   * Only use if you need to completely undo the migration.
   */
  async down(db: Firestore): Promise<void> {
    console.log('⚠️  Rolling back migration: Restoring old default values');
    console.log('⏳ Fetching all users...\n');
    
    const usersSnapshot = await db.collection('users').get();
    let processedUsers = 0;
    let updatedUsers = 0;
    let processedBosses = 0;
    let updatedBosses = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      processedUsers++;
      console.log(`👤 Processing user: ${userId}`);
      
      // Restore displayName if it's empty
      if (userData.displayName === '') {
        await userDoc.ref.update({
          displayName: 'User',
          updatedAt: new Date().toISOString(),
        });
        updatedUsers++;
        console.log(`   Restored user displayName: "" → "User"`);
      }
      
      const bossesRef = db.collection('users').doc(userId).collection('bosses');
      const bossesSnapshot = await bossesRef.get();
      
      if (bossesSnapshot.empty) {
        continue;
      }
      
      const batch = db.batch();
      let batchCount = 0;
      
      for (const bossDoc of bossesSnapshot.docs) {
        const bossData = bossDoc.data();
        const bossId = bossDoc.id;
        const updates: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
        let needsUpdate = false;
        
        if (bossData.name === '') {
          updates.name = 'My Boss';
          needsUpdate = true;
          console.log(`   📝 Boss ${bossId}: name "" → "My Boss"`);
        }
        
        if (bossData.position === '') {
          updates.position = 'Manager';
          needsUpdate = true;
          console.log(`   📝 Boss ${bossId}: position "" → "Manager"`);
        }
        
        if (bossData.managementStyle === '') {
          updates.managementStyle = 'Unknown';
          needsUpdate = true;
          console.log(`   📝 Boss ${bossId}: managementStyle "" → "Unknown"`);
        }
        
        if (needsUpdate) {
          updates.updatedAt = new Date().toISOString();
          batch.update(bossDoc.ref, updates);
          updatedBosses++;
          batchCount++;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`   💾 Committed ${batchCount} boss update(s)`);
      }
    }
    
    console.log(`\n✅ Rollback complete!`);
    console.log(`📊 Summary:`);
    console.log(`   Users processed: ${processedUsers}`);
    console.log(`   Users updated: ${updatedUsers}`);
    console.log(`   Bosses processed: ${processedBosses}`);
    console.log(`   Bosses updated: ${updatedBosses}`);
  },
};
