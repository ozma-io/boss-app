/**
 * Firebase Cloud Functions for Boss Relationship Tracker MVP
 * 
 * This file contains serverless backend logic for:
 * - Scheduled notifications
 * - Firestore triggers
 * - FCM push notifications
 * - Test user authentication
 * - Intercom JWT authentication
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';

admin.initializeApp();

export { sendFacebookConversionEvent } from './facebook';
export { getIntercomJwt } from './intercom';

const TEST_EMAIL = 'test@test.test';

/**
 * Generate custom token for test user authentication (2nd Gen)
 * This allows test@test.test to bypass magic link verification
 * while still maintaining proper data isolation
 * 
 * IMPORTANT: Must delete 1st gen version first:
 * firebase functions:delete generateTestUserToken --region us-central1
 * 
 * Note: Requires iam.serviceAccountTokenCreator role on Compute Engine service account
 */
export const generateTestUserToken = onCall(
  {
    region: 'us-central1',
    invoker: 'public', // Allow unauthenticated access
  },
  async (request) => {
    const { email } = request.data;

    // Security: Only generate tokens for the exact test email
    if (email !== TEST_EMAIL) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Custom token generation is only available for test users'
      );
    }

    try {
      // Create or get the test user
      let uid: string;
      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        uid = userRecord.uid;
        console.log(`Test user already exists with uid: ${uid}`);
      } catch (error) {
        // User doesn't exist, create it
        const newUser = await admin.auth().createUser({
          email: email,
          emailVerified: true,
        });
        uid = newUser.uid;
        console.log(`Created new test user with uid: ${uid}`);
      }

      // Generate custom token
      const customToken = await admin.auth().createCustomToken(uid, {
        email: email,
      });

      return { token: customToken };
    } catch (error) {
      console.error('Error generating test user token:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to generate authentication token'
      );
    }
  }
);

