/**
 * Migration: Clear Boss Started At Dates
 * 
 * Date: 2025-11-25
 * Purpose: Replace all boss startedAt date values with empty strings
 * 
 * This migration:
 * 1. Sets boss.startedAt to "" for all bosses that have a date value
 * 
 * Safe to run multiple times (idempotent).
 */

import { Firestore } from 'firebase-admin/firestore';

export const migration = {
  name: '2025-11-25-clear-boss-started-at-dates',
  description: 'Replace all boss startedAt date values with empty strings',
  date: '2025-11-25',
  author: 'system',
  
  async up(db: Firestore): Promise<void> {
    const batchSize = 500;
    let processedUsers = 0;
    let processedBosses = 0;
    let updatedBosses = 0;
    
    console.log('📊 Starting migration: Clear boss startedAt dates');
    console.log('⏳ Fetching all users...\n');
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`Found ${usersSnapshot.size} users\n`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      processedUsers++;
      
      console.log(`👤 [${processedUsers}/${usersSnapshot.size}] Processing user: ${userId}`);
      
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
        
        // Check if startedAt needs to be cleared
        const needsUpdate = bossData.startedAt && bossData.startedAt !== '';
        
        if (!needsUpdate) {
          console.log(`   📋 Boss ${bossId}: startedAt already empty or undefined`);
          continue;
        }
        
        const updates: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
          startedAt: '',
          updatedAt: new Date().toISOString(),
        };
        
        console.log(`   📝 Boss ${bossId}: startedAt "${bossData.startedAt}" → ""`);
        
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
    console.log(`   Bosses processed: ${processedBosses}`);
    console.log(`   Bosses updated: ${updatedBosses}`);
  },
  
  /**
   * Rollback function
   * 
   * Warning: This cannot restore the original dates.
   * It will set startedAt to the current date for all bosses with empty startedAt.
   * Only use if you need to completely undo the migration.
   */
  async down(db: Firestore): Promise<void> {
    console.log('⚠️  Rolling back migration: Setting startedAt to current date');
    console.log('⚠️  Warning: Original dates cannot be restored!');
    console.log('⏳ Fetching all users...\n');
    
    const usersSnapshot = await db.collection('users').get();
    let processedUsers = 0;
    let processedBosses = 0;
    let updatedBosses = 0;
    const now = new Date().toISOString();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      processedUsers++;
      console.log(`👤 Processing user: ${userId}`);
      
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
        processedBosses++;
        
        // Restore startedAt if it's empty
        if (!bossData.startedAt || bossData.startedAt === '') {
          const updates: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
            startedAt: now,
            updatedAt: now,
          };
          
          batch.update(bossDoc.ref, updates);
          updatedBosses++;
          batchCount++;
          console.log(`   📝 Boss ${bossId}: startedAt "" → "${now}"`);
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
    console.log(`   Bosses processed: ${processedBosses}`);
    console.log(`   Bosses updated: ${updatedBosses}`);
  },
};

