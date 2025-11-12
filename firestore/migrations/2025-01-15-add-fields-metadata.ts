/**
 * Migration: Add _fieldsMeta to Boss Documents
 * 
 * Date: 2025-01-15
 * Purpose: Add _fieldsMeta entries for existing custom_ fields in Boss documents
 * 
 * This migration:
 * 1. Scans all Boss documents across all users
 * 2. Identifies any fields starting with 'custom_'
 * 3. Adds metadata entries to _fieldsMeta if not already present
 * 4. Never modifies existing field values
 * 
 * Safe to run multiple times (idempotent).
 */

import { FieldValue, Firestore } from 'firebase-admin/firestore';

export const migration = {
  name: '2025-01-15-add-fields-metadata',
  description: 'Add _fieldsMeta entries for existing custom_ fields in Boss documents',
  date: '2025-01-15',
  author: 'system',
  
  async up(db: Firestore): Promise<void> {
    const batchSize = 500;
    let processedUsers = 0;
    let processedBosses = 0;
    let addedMetadataCount = 0;
    
    console.log('📊 Starting migration: Add _fieldsMeta to Boss documents');
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
      
      // Process in batches
      let batch = db.batch();
      let batchCount = 0;
      
      for (const bossDoc of bossesSnapshot.docs) {
        const bossData = bossDoc.data();
        const bossId = bossDoc.id;
        processedBosses++;
        
        // Find all custom_ fields
        const customFields = Object.keys(bossData).filter(key => key.startsWith('custom_'));
        
        if (customFields.length === 0) {
          console.log(`   📋 Boss ${bossId}: No custom fields, skipping`);
          continue;
        }
        
        // Get existing metadata
        const existingMeta = bossData._fieldsMeta || {};
        
        // Check which custom fields need metadata
        const fieldsNeedingMeta = customFields.filter(field => !existingMeta[field]);
        
        if (fieldsNeedingMeta.length === 0) {
          console.log(`   ✓ Boss ${bossId}: All ${customFields.length} custom field(s) already have metadata`);
          continue;
        }
        
        console.log(`   📝 Boss ${bossId}: Adding metadata for ${fieldsNeedingMeta.length} custom field(s)`);
        
        // Create metadata for fields that need it
        const newMetadata: any = { ...existingMeta };
        const timestamp = new Date().toISOString();
        
        for (const fieldKey of fieldsNeedingMeta) {
          // Create basic metadata for unknown custom fields
          // Source is marked as 'user_added' since we don't know where it came from
          newMetadata[fieldKey] = {
            label: fieldKey.replace('custom_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type: 'text',
            category: 'Custom',
            source: 'user_added',
            createdAt: timestamp,
          };
          
          addedMetadataCount++;
          console.log(`      + ${fieldKey}`);
        }
        
        // Update the document with new metadata
        batch.update(bossDoc.ref, {
          _fieldsMeta: newMetadata,
          updatedAt: timestamp,
        });
        
        batchCount++;
        
        // Commit batch when it reaches the limit
        if (batchCount >= batchSize) {
          console.log(`   💾 Committing batch of ${batchCount} update(s)...`);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
      
      // Commit remaining updates for this user
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
    console.log(`   Metadata entries added: ${addedMetadataCount}`);
  },
  
  /**
   * Rollback function
   * 
   * Warning: This removes ALL _fieldsMeta from Boss documents.
   * Only use if you need to completely undo the migration.
   */
  async down(db: Firestore): Promise<void> {
    console.log('⚠️  Rolling back migration: Removing _fieldsMeta from Boss documents');
    console.log('⏳ Fetching all users...\n');
    
    const usersSnapshot = await db.collection('users').get();
    let processedBosses = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`👤 Processing user: ${userId}`);
      
      const bossesRef = db.collection('users').doc(userDoc.id).collection('bosses');
      const bossesSnapshot = await bossesRef.get();
      
      if (bossesSnapshot.empty) {
        continue;
      }
      
      const batch = db.batch();
      
      for (const bossDoc of bossesSnapshot.docs) {
        batch.update(bossDoc.ref, {
          _fieldsMeta: FieldValue.delete(),
          updatedAt: new Date().toISOString(),
        });
        processedBosses++;
      }
      
      await batch.commit();
      console.log(`   Removed _fieldsMeta from ${bossesSnapshot.size} boss(es)`);
    }
    
    console.log(`\n✅ Rollback complete! Removed _fieldsMeta from ${processedBosses} Boss documents`);
  },
};

