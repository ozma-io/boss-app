/**
 * Migration: Add Chat Schema
 * 
 * Date: 2025-11-14
 * Purpose: Document the new chat schema for AI conversations
 * 
 * This migration:
 * 1. Documents the new chatThreads and messages collections
 * 2. No data migration needed (new feature, no existing data)
 * 3. Schema uses OpenAI-compatible multimodal format
 * 
 * Collections:
 * - /users/{userId}/chatThreads/{threadId}
 * - /users/{userId}/chatThreads/{threadId}/messages/{messageId}
 * 
 * Safe to run multiple times (idempotent, no-op).
 */

import { Firestore } from 'firebase-admin/firestore';

export const migration = {
  name: '2025-11-14-add-chat-schema',
  description: 'Add chat schema with OpenAI-compatible multimodal format',
  date: '2025-11-14',
  author: 'system',
  
  async up(db: Firestore): Promise<void> {
    console.log('📊 Starting migration: Add Chat Schema');
    console.log('');
    console.log('This migration documents the new chat schema.');
    console.log('No data migration is needed as this is a new feature.');
    console.log('');
    console.log('New collections:');
    console.log('  - /users/{userId}/chatThreads/{threadId}');
    console.log('  - /users/{userId}/chatThreads/{threadId}/messages/{messageId}');
    console.log('');
    console.log('Schema details:');
    console.log('  - ChatThread: createdAt, updatedAt, messageCount');
    console.log('  - ChatMessage: role, content[], timestamp');
    console.log('  - Content format: OpenAI-compatible multimodal (text, image_url)');
    console.log('');
    console.log('✅ Migration complete (no data changes needed)');
  },
  
  /**
   * Rollback function
   * 
   * Warning: This would delete all chat data.
   * Only use if absolutely necessary.
   */
  async down(db: Firestore): Promise<void> {
    console.log('⚠️  Rolling back migration: Remove Chat Schema');
    console.log('');
    console.log('⚠️  WARNING: This will delete ALL chat data!');
    console.log('');
    
    const batchSize = 500;
    let deletedThreads = 0;
    let deletedMessages = 0;
    
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
        
        // Delete all messages in this thread
        const messagesRef = threadDoc.ref.collection('messages');
        const messagesSnapshot = await messagesRef.get();
        
        if (!messagesSnapshot.empty) {
          let batch = db.batch();
          let batchCount = 0;
          
          for (const messageDoc of messagesSnapshot.docs) {
            batch.delete(messageDoc.ref);
            batchCount++;
            deletedMessages++;
            
            if (batchCount >= batchSize) {
              await batch.commit();
              batch = db.batch();
              batchCount = 0;
            }
          }
          
          if (batchCount > 0) {
            await batch.commit();
          }
          
          console.log(`   Deleted ${messagesSnapshot.size} message(s) from thread ${threadId}`);
        }
        
        // Delete the thread document
        await threadDoc.ref.delete();
        deletedThreads++;
      }
    }
    
    console.log('');
    console.log('✅ Rollback complete!');
    console.log('📊 Summary:');
    console.log(`   Threads deleted: ${deletedThreads}`);
    console.log(`   Messages deleted: ${deletedMessages}`);
  },
};

