/**
 * Migration: Sync User Emails from Firebase Auth to Firestore
 * 
 * This migration syncs email addresses from Firebase Auth to Firestore user documents.
 * Fixes the issue where user documents were created with empty email strings.
 * 
 * What it does:
 * - Fetches all users from Firebase Auth
 * - For each user, checks if their Firestore document exists
 * - Updates Firestore document with correct email from Auth if email is empty or missing
 * - Skips users that already have the correct email
 * 
 * Safe to run multiple times (idempotent).
 */

import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';

export const migration = {
  name: '2025-11-13-sync-user-emails-from-auth',
  description: 'Sync email addresses from Firebase Auth to Firestore user documents',
  date: '2025-11-13',
  author: 'system',
  
  async up(db: Firestore): Promise<void> {
    const batchSize = 500;
    let processedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log('📧 Syncing user emails from Firebase Auth to Firestore...');
    console.log('');
    
    try {
      // Fetch all users from Firebase Auth
      let allUsers: admin.auth.UserRecord[] = [];
      let pageToken: string | undefined;
      
      console.log('📊 Fetching all users from Firebase Auth...');
      
      do {
        const listUsersResult = await admin.auth().listUsers(1000, pageToken);
        allUsers = allUsers.concat(listUsersResult.users);
        pageToken = listUsersResult.pageToken;
      } while (pageToken);
      
      console.log(`Found ${allUsers.length} users in Firebase Auth`);
      console.log('');
      
      // Process users in batches
      let batch = db.batch();
      let batchCount = 0;
      
      for (const authUser of allUsers) {
        processedCount++;
        
        try {
          const userId = authUser.uid;
          const authEmail = authUser.email || '';
          
          // Get Firestore document
          const userDocRef = db.collection('users').doc(userId);
          const userDoc = await userDocRef.get();
          
          if (!userDoc.exists) {
            console.log(`⚠️  User ${userId} exists in Auth but not in Firestore, skipping`);
            skippedCount++;
            continue;
          }
          
          const userData = userDoc.data();
          const firestoreEmail = userData?.email || '';
          
          // Check if email needs updating
          if (firestoreEmail === authEmail && firestoreEmail !== '') {
            // Email is already correct and not empty
            if (processedCount % 100 === 0) {
              console.log(`✓ Processed ${processedCount}/${allUsers.length} users...`);
            }
            skippedCount++;
            continue;
          }
          
          // Email is missing or incorrect - update it
          console.log(`🔄 Updating user ${userId}: "${firestoreEmail}" -> "${authEmail}"`);
          
          batch.update(userDocRef, {
            email: authEmail,
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
          
        } catch (error) {
          errorCount++;
          console.error(`❌ Error processing user ${authUser.uid}:`, error instanceof Error ? error.message : String(error));
          // Continue processing other users even if one fails
        }
      }
      
      // Commit remaining updates
      if (batchCount > 0) {
        console.log(`💾 Committing final batch of ${batchCount} updates...`);
        await batch.commit();
      }
      
      console.log('');
      console.log('✅ Migration complete!');
      console.log(`   Total users processed: ${processedCount}`);
      console.log(`   Users updated: ${updatedCount}`);
      console.log(`   Users skipped (already correct): ${skippedCount}`);
      if (errorCount > 0) {
        console.log(`   Errors: ${errorCount}`);
      }
      
    } catch (error) {
      console.error('');
      console.error('❌ Migration failed with error:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  },
  
  // No rollback needed - we're only syncing data, not transforming it
  async down(db: Firestore): Promise<void> {
    console.log('⚠️  This migration does not support rollback.');
    console.log('It only syncs email from Auth to Firestore, which is a data correction.');
    console.log('If you need to revert, you would need to manually update the emails back.');
  },
};

