/**
 * Migration: Add User Message Count
 * 
 * Date: 2025-12-11
 * Purpose: Add userMessageCount field to chatThreads for tracking user messages separately
 * 
 * This migration:
 * 1. Iterates through all users and their chatThreads
 * 2. Counts messages where role === 'user' in each thread
 * 3. Updates thread with userMessageCount field
 * 4. Skips threads that already have the field
 * 
 * Safe to run multiple times (idempotent).
 */

import { FieldValue, Firestore } from 'firebase-admin/firestore';

export const migration = {
  name: '2025-12-11-add-user-message-count',
  description: 'Add userMessageCount field to chat threads for analytics',
  date: '2025-12-11',
  author: 'system',
  
  async up(db: Firestore): Promise<void> {
    const batchSize = 500;
    let processedThreads = 0;
    let skippedThreads = 0;
    
    console.log('📊 Starting migration: Add User Message Count');
    console.log('');
    console.log('Fetching all users...');
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`Found ${usersSnapshot.size} users`);
    console.log('');
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`👤 Processing user: ${userId}`);
      
      // Get all chat threads for this user
      const threadsRef = db.collection('users').doc(userId).collection('chatThreads');
      const threadsSnapshot = await threadsRef.get();
      
      if (threadsSnapshot.empty) {
        console.log('   No chat threads found, skipping');
        continue;
      }
      
      console.log(`   Found ${threadsSnapshot.size} thread(s)`);
      
      for (const threadDoc of threadsSnapshot.docs) {
        const threadId = threadDoc.id;
        const threadData = threadDoc.data();
        
        // Skip if field already exists
        if ('userMessageCount' in threadData) {
          console.log(`   ⏭️  Thread ${threadId} already has userMessageCount, skipping`);
          skippedThreads++;
          continue;
        }
        
        // Count user messages in this thread
        const messagesRef = threadDoc.ref.collection('messages');
        const messagesSnapshot = await messagesRef.where('role', '==', 'user').get();
        const userMessageCount = messagesSnapshot.size;
        
        console.log(`   📝 Thread ${threadId}: found ${userMessageCount} user message(s)`);
        
        // Update thread with userMessageCount
        await threadDoc.ref.update({
          userMessageCount: userMessageCount,
        });
        
        processedThreads++;
      }
    }
    
    console.log('');
    console.log('✅ Migration complete!');
    console.log('📊 Summary:');
    console.log(`   Threads updated: ${processedThreads}`);
    console.log(`   Threads skipped: ${skippedThreads}`);
  },
  
  /**
   * Rollback function
   * Removes the userMessageCount field from all threads
   */
  async down(db: Firestore): Promise<void> {
    console.log('⚠️  Rolling back migration: Remove User Message Count');
    console.log('');
    
    let removedCount = 0;
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`Found ${usersSnapshot.size} users`);
    console.log('');
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`👤 Processing user: ${userId}`);
      
      // Get all chat threads for this user
      const threadsRef = db.collection('users').doc(userId).collection('chatThreads');
      const threadsSnapshot = await threadsRef.get();
      
      if (threadsSnapshot.empty) {
        console.log('   No chat threads found, skipping');
        continue;
      }
      
      for (const threadDoc of threadsSnapshot.docs) {
        const threadData = threadDoc.data();
        
        if ('userMessageCount' in threadData) {
          await threadDoc.ref.update({
            userMessageCount: FieldValue.delete(),
          });
          removedCount++;
        }
      }
    }
    
    console.log('');
    console.log('✅ Rollback complete!');
    console.log(`   Removed userMessageCount from ${removedCount} thread(s)`);
  },
};
