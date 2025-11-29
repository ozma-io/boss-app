// @ts-nocheck
/**
 * Migration: Convert Fact Entries to Note Entries
 * 
 * Converts all existing fact entries (type: 'fact') to note entries (type: 'note', subtype: 'note').
 * This migration supports the removal of the FactEntry schema in favor of a unified NoteEntry approach.
 */

import { FieldValue, Firestore } from 'firebase-admin/firestore';

export const migration = {
  name: '2025-11-22-convert-fact-entries-to-notes',
  description: 'Convert all fact entries to note entries with subtype "note"',
  date: '2025-11-22',
  author: 'system',
  
  async up(db: Firestore): Promise<void> {
    const batchSize = 500;
    let processedCount = 0;
    let convertedCount = 0;
    
    console.log('📊 Starting fact-to-note conversion migration...');
    
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`\n👤 Processing user: ${userId}`);
      
      const entriesRef = db.collection('users').doc(userId).collection('entries');
      const factEntriesSnapshot = await entriesRef.where('type', '==', 'fact').get();
      
      if (factEntriesSnapshot.empty) {
        console.log(`  ℹ️  No fact entries found for user ${userId}`);
        continue;
      }
      
      console.log(`  📋 Found ${factEntriesSnapshot.size} fact entries to convert`);
      
      let batch = db.batch();
      let batchCount = 0;
      
      for (const entryDoc of factEntriesSnapshot.docs) {
        const entryData = entryDoc.data();
        
        // Convert fact entry to note entry
        const updatedData: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
          type: 'note',
          subtype: 'note',
          title: entryData.title || 'Assessment', // Keep existing title or default
          content: entryData.value ? String(entryData.value) : entryData.content || '', // Convert value to content
          timestamp: entryData.timestamp,
          updatedAt: new Date().toISOString(),
          // Remove fact-specific fields
          factKey: FieldValue.delete(),
          value: FieldValue.delete(),
        };
        
        // Only add fields that are not undefined
        if (entryData.icon) {
          updatedData.icon = entryData.icon;
        }
        if (entryData.source) {
          updatedData.source = entryData.source;
        }
        if (entryData.createdAt) {
          updatedData.createdAt = entryData.createdAt;
        }
        if (entryData.category) {
          updatedData.category = entryData.category;
        }
        
        batch.update(entryDoc.ref, updatedData);
        
        batchCount++;
        processedCount++;
        convertedCount++;
        
        if (batchCount >= batchSize) {
          console.log(`  💾 Committing batch of ${batchCount} conversions...`);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        console.log(`  💾 Committing final batch of ${batchCount} conversions...`);
        await batch.commit();
      }
      
      console.log(`  ✅ Converted ${factEntriesSnapshot.size} fact entries to note entries`);
    }
    
    console.log(`\n✅ Migration complete!`);
    console.log(`   📊 Total entries processed: ${processedCount}`);
    console.log(`   🔄 Total entries converted: ${convertedCount}`);
  },
  
  async down(db: Firestore): Promise<void> {
    console.log('⚠️  Rolling back fact-to-note conversion...');
    console.log('⚠️  WARNING: This rollback may not be perfect as some data transformation is lossy');
    
    const batchSize = 500;
    let processedCount = 0;
    
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`\n👤 Processing user: ${userId}`);
      
      const entriesRef = db.collection('users').doc(userId).collection('entries');
      
      // Find note entries that were likely converted from facts
      // (have source: 'onboarding_funnel' and subtype: 'note')
      const convertedEntriesSnapshot = await entriesRef
        .where('type', '==', 'note')
        .where('subtype', '==', 'note')
        .where('source', '==', 'onboarding_funnel')
        .get();
      
      if (convertedEntriesSnapshot.empty) {
        console.log(`  ℹ️  No converted entries found for user ${userId}`);
        continue;
      }
      
      console.log(`  📋 Found ${convertedEntriesSnapshot.size} entries to rollback`);
      
      let batch = db.batch();
      let batchCount = 0;
      
      for (const entryDoc of convertedEntriesSnapshot.docs) {
        const entryData = entryDoc.data();
        
        // Convert back to fact entry (best effort)
        const rolledBackData: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
          type: 'fact',
          factKey: `custom_${entryData.title?.toLowerCase().replace(/\s+/g, '')}` || 'custom_unknown',
          value: entryData.content || '',
          title: entryData.title,
          content: '', // Facts typically had empty content
          timestamp: entryData.timestamp,
          updatedAt: new Date().toISOString(),
          // Remove note-specific fields
          subtype: FieldValue.delete(),
        };
        
        // Only add fields that are not undefined
        if (entryData.icon) {
          rolledBackData.icon = entryData.icon;
        }
        if (entryData.source) {
          rolledBackData.source = entryData.source;
        }
        if (entryData.createdAt) {
          rolledBackData.createdAt = entryData.createdAt;
        }
        if (entryData.category) {
          rolledBackData.category = entryData.category;
        }
        
        batch.update(entryDoc.ref, rolledBackData);
        
        batchCount++;
        processedCount++;
        
        if (batchCount >= batchSize) {
          console.log(`  💾 Committing batch of ${batchCount} rollbacks...`);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        console.log(`  💾 Committing final batch of ${batchCount} rollbacks...`);
        await batch.commit();
      }
    }
    
    console.log(`\n✅ Rollback complete. Processed ${processedCount} entries`);
    console.log('⚠️  Note: Some data may have been lost during rollback due to transformation differences');
  },
};
