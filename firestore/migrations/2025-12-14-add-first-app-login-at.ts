/**
 * Migration: Add firstAppLoginAt field to users
 * 
 * This migration adds the firstAppLoginAt field to existing users who have
 * already logged into the mobile app. This field is used to determine if
 * Facebook registration events should be sent (only on first app login).
 * 
 * Detection logic for existing app users:
 * - Has FCM token (push notifications) → definitely used app
 * - Has tracking permission status (not 'not_determined') → saw ATT prompt in app
 * - Has notification permission status (not 'not_asked') → saw notification prompt in app
 * - Has lastActivityAt → was active in app
 * 
 * For users who match these criteria, we set firstAppLoginAt to their
 * createdAt timestamp (best approximation of when they first logged in).
 * 
 * Users who don't match these criteria are likely:
 * - Web-only users (never logged into mobile app)
 * - New users who will get firstAppLoginAt set on actual first login
 */

import { Firestore } from 'firebase-admin/firestore';

export const migration = {
  name: '2025-12-14-add-first-app-login-at',
  description: 'Add firstAppLoginAt field to users who have already used the mobile app',
  date: '2025-12-14',
  author: 'system',
  
  async up(db: Firestore): Promise<void> {
    const batchSize = 500;
    let processedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    
    console.log('📊 Fetching all users...');
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`Found ${usersSnapshot.size} users`);
    
    // Process in batches
    let batch = db.batch();
    let batchCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      processedCount++;
      
      // Skip if firstAppLoginAt already exists
      if (userData.firstAppLoginAt) {
        console.log(`⏭️  User ${userDoc.id} already has firstAppLoginAt, skipping`);
        skippedCount++;
        continue;
      }
      
      // Determine if user has logged into mobile app
      const hasFcmToken = !!userData.fcmToken;
      const hasSeenTrackingPrompt = userData.trackingPermissionStatus && userData.trackingPermissionStatus !== 'not_determined';
      const hasSeenNotificationPrompt = userData.notificationPermissionStatus && userData.notificationPermissionStatus !== 'not_asked';
      const hasActivityTimestamp = !!userData.lastActivityAt;
      
      const hasUsedMobileApp = hasFcmToken || hasSeenTrackingPrompt || hasSeenNotificationPrompt || hasActivityTimestamp;
      
      if (hasUsedMobileApp) {
        // Find earliest timestamp from app usage indicators
        const timestamps: Date[] = [];
        
        // Helper to convert any timestamp format to Date
        const toDate = (ts: any): Date | null => { // eslint-disable-line @typescript-eslint/no-explicit-any
          if (!ts) return null;
          if (typeof ts === 'string') return new Date(ts);
          if (ts.toDate) return ts.toDate(); // Firestore Timestamp
          return null;
        };
        
        // Check prompt histories (most accurate indicators of first app usage)
        if (userData.trackingPromptHistory && userData.trackingPromptHistory.length > 0) {
          const firstPrompt = userData.trackingPromptHistory[0];
          const date = toDate(firstPrompt.timestamp);
          if (date) timestamps.push(date);
        }
        
        if (userData.notificationPromptHistory && userData.notificationPromptHistory.length > 0) {
          const firstPrompt = userData.notificationPromptHistory[0];
          const date = toDate(firstPrompt.timestamp);
          if (date) timestamps.push(date);
        }
        
        // Check direct prompt timestamps
        if (userData.lastTrackingPromptAt) {
          const date = toDate(userData.lastTrackingPromptAt);
          if (date) timestamps.push(date);
        }
        
        if (userData.lastNotificationPromptAt) {
          const date = toDate(userData.lastNotificationPromptAt);
          if (date) timestamps.push(date);
        }
        
        // Fallback to createdAt if no prompt timestamps available
        if (timestamps.length === 0 && userData.createdAt) {
          const date = toDate(userData.createdAt);
          if (date) timestamps.push(date);
        }
        
        // Use earliest timestamp, or current time as last resort
        const firstAppLoginAt = timestamps.length > 0
          ? new Date(Math.min(...timestamps.map(d => d.getTime()))).toISOString()
          : new Date().toISOString();
        
        console.log(`✏️  Setting firstAppLoginAt for user ${userDoc.id} (${
          hasFcmToken ? 'has fcmToken' : 
          hasSeenTrackingPrompt ? 'saw tracking prompt' : 
          hasSeenNotificationPrompt ? 'saw notification prompt' :
          'has activity timestamp'
        })`);
        
        batch.update(userDoc.ref, {
          firstAppLoginAt: firstAppLoginAt,
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
      } else {
        console.log(`⏭️  User ${userDoc.id} likely web-only or new, skipping (will be set on actual first app login)`);
        skippedCount++;
      }
    }
    
    // Commit remaining updates
    if (batchCount > 0) {
      console.log(`💾 Committing final batch of ${batchCount} updates...`);
      await batch.commit();
    }
    
    console.log(`\n✅ Migration complete!`);
    console.log(`   Processed: ${processedCount} users`);
    console.log(`   Updated: ${updatedCount} users (detected as mobile app users)`);
    console.log(`   Skipped: ${skippedCount} users (web-only or new users)`);
  },
  
  // Optional: Rollback function
  async down(db: Firestore): Promise<void> {
    console.log('⚠️  Rolling back migration...');
    
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users to process`);
    
    let batch = db.batch();
    let batchCount = 0;
    const batchSize = 500;
    let rollbackCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      if (userData.firstAppLoginAt) {
        console.log(`🔄 Removing firstAppLoginAt from user ${userDoc.id}`);
        
        batch.update(userDoc.ref, {
          firstAppLoginAt: null,
          updatedAt: new Date().toISOString(),
        });
        
        batchCount++;
        rollbackCount++;
        
        if (batchCount >= batchSize) {
          console.log(`💾 Committing batch of ${batchCount} rollback updates...`);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }
    
    if (batchCount > 0) {
      console.log(`💾 Committing final batch of ${batchCount} rollback updates...`);
      await batch.commit();
    }
    
    console.log(`✅ Rollback complete! Removed firstAppLoginAt from ${rollbackCount} users`);
  },
};
