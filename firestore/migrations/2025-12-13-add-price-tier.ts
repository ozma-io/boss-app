/**
 * Migration: Add priceTier field to subscription
 * 
 * This migration adds the priceTier field to existing user subscriptions.
 * The priceTier tracks which price group (tier1/tier2/tier3) the user is on,
 * allowing different pricing for different markets or A/B test experiments.
 * 
 * For existing subscriptions, we default to 'tier1' as that was the only
 * tier available before this change.
 */

import { Firestore } from 'firebase-admin/firestore';

export const migration = {
  name: '2025-12-13-add-price-tier',
  description: 'Add priceTier field to user subscription objects (defaults to tier1 for existing subscriptions)',
  date: '2025-12-13',
  author: 'system',
  
  async up(db: Firestore): Promise<void> {
    const batchSize = 500;
    let processedCount = 0;
    let updatedCount = 0;
    
    console.log('📊 Fetching all users with subscriptions...');
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`Found ${usersSnapshot.size} users`);
    
    // Process in batches
    let batch = db.batch();
    let batchCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      processedCount++;
      
      // Skip if no subscription
      if (!userData.subscription) {
        continue;
      }
      
      // Skip if priceTier already exists
      if ('priceTier' in userData.subscription) {
        console.log(`⏭️  User ${userDoc.id} already has priceTier, skipping`);
        continue;
      }
      
      console.log(`✏️  Adding priceTier to user ${userDoc.id} (${userData.subscription.provider})`);
      
      // Add priceTier field (default to tier1 for existing subscriptions)
      batch.update(userDoc.ref, {
        'subscription.priceTier': 'tier1',
        updatedAt: new Date().toISOString(),
      });
      
      batchCount++;
      updatedCount++;
      
      // Commit batch when it reaches the limit
      if (batchCount >= batchSize) {
        console.log(`💾 Committing batch of ${batchCount} updates...`);
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    
    // Commit remaining updates
    if (batchCount > 0) {
      console.log(`💾 Committing final batch of ${batchCount} updates...`);
      await batch.commit();
    }
    
    console.log(`\n✅ Migration complete!`);
    console.log(`   Processed: ${processedCount} users`);
    console.log(`   Updated: ${updatedCount} subscriptions`);
  },
  
  // Optional: Rollback function
  async down(db: Firestore): Promise<void> {
    console.log('⚠️  Rolling back migration...');
    
    const usersSnapshot = await db.collection('users').get();
    
    let batch = db.batch();
    let batchCount = 0;
    const batchSize = 500;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      if (userData.subscription && 'priceTier' in userData.subscription) {
        // Remove priceTier field using dot notation
        batch.update(userDoc.ref, {
          'subscription.priceTier': null, // Set to null instead of delete for cleaner rollback
        });
        
        batchCount++;
        
        if (batchCount >= batchSize) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log('✅ Rollback complete');
  },
};

