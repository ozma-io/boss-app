/**
 * Account Deletion Cloud Function
 * 
 * Handles complete account deletion including:
 * - Subscription cancellation (Stripe/Apple/Google)
 * - All Firestore data deletion using recursiveDelete()
 * - Firebase Authentication account removal
 * 
 * Uses partial error handling - continues deletion even if some steps fail
 */

import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { cancelStripeSubscription } from './iap-verification';
import { logger } from './logger';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const intercomAccessToken = defineSecret('INTERCOM_ACCESS_TOKEN');

// Intercom API version
const INTERCOM_API_VERSION = '2.11';

interface DeleteAccountRequest {
  confirmationText: string;
}

interface DeleteAccountResponse {
  success: boolean;
  error?: string;
}

/**
 * Delete user data from Intercom
 * 
 * We intentionally send email to Intercom for support messaging functionality.
 * This function permanently deletes the user from Intercom when account is deleted.
 * 
 * Process:
 * 1. Find contact by external_id (Firebase UID)
 * 2. Delete contact permanently
 * 
 * Returns success even if user doesn't exist in Intercom
 * Only returns failure if deletion was attempted but failed
 */
async function deleteFromIntercom(userId: string): Promise<{success: boolean; error?: string}> {
  logger.info('Attempting to delete user from Intercom', { userId });

  try {
    const accessToken = intercomAccessToken.value().trim();
    
    if (!accessToken) {
      logger.warn('Intercom access token not configured, skipping deletion', { userId });
      return { success: true }; // Not a failure - service not configured
    }

    // Step 1: Find contact by external_id
    logger.info('Finding Intercom contact by external_id', { userId });
    
    const findResponse = await fetch(
      `https://api.intercom.io/contacts?external_id=${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Intercom-Version': INTERCOM_API_VERSION
        }
      }
    );

    if (!findResponse.ok) {
      if (findResponse.status === 404) {
        logger.info('User not found in Intercom, nothing to delete', { userId });
        return { success: true }; // User doesn't exist - that's fine
      }
      
      const errorText = await findResponse.text();
      logger.error('Failed to find Intercom contact', { 
        userId, 
        status: findResponse.status,
        error: errorText 
      });
      return { 
        success: false, 
        error: `Failed to find contact: ${findResponse.status}` 
      };
    }

    const findData = await findResponse.json();
    
    if (!findData.data || findData.data.length === 0) {
      logger.info('No Intercom contacts found with this external_id', { userId });
      return { success: true }; // User doesn't exist - that's fine
    }

    const contactId = findData.data[0].id;
    logger.info('Found Intercom contact, proceeding with deletion', { userId, contactId });

    // Step 2: Delete contact
    const deleteResponse = await fetch(
      `https://api.intercom.io/contacts/${contactId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Intercom-Version': INTERCOM_API_VERSION
        }
      }
    );

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      logger.error('Failed to delete Intercom contact', { 
        userId, 
        contactId,
        status: deleteResponse.status,
        error: errorText 
      });
      return { 
        success: false, 
        error: `Failed to delete contact: ${deleteResponse.status}` 
      };
    }

    const deleteData = await deleteResponse.json();
    
    if (deleteData.deleted === true || deleteData.id === contactId) {
      logger.info('Successfully deleted user from Intercom', { userId, contactId });
      return { success: true };
    } else {
      logger.warn('Unexpected response from Intercom delete', { userId, contactId, response: deleteData });
      return { success: true }; // Probably deleted anyway
    }

  } catch (error) {
    logger.error('Error deleting from Intercom', { userId, error });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Cancel active subscription if exists
 * Returns success even if subscription is already cancelled or doesn't exist
 * Only returns failure if cancellation was attempted but failed
 */
async function cancelUserSubscription(userId: string): Promise<{success: boolean; error?: string}> {
  logger.info('Checking for active subscription to cancel', { userId });

  try {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      logger.info('User document does not exist, skipping subscription cancellation', { userId });
      return { success: true };
    }

    const userData = userDoc.data();

    if (!userData?.subscription) {
      logger.info('No subscription found, skipping cancellation', { userId });
      return { success: true };
    }

    const subscription = userData.subscription;

    // Check if subscription is already cancelled or expired
    if (subscription.status === 'cancelled' || subscription.status === 'expired' || subscription.status === 'none') {
      logger.info('Subscription already inactive, skipping cancellation', { userId, status: subscription.status });
      return { success: true };
    }

    const provider = subscription.provider;

    if (provider === 'stripe' && subscription.stripeSubscriptionId) {
      // Use existing Stripe cancellation function
      logger.info('Cancelling Stripe subscription', { userId, subscriptionId: subscription.stripeSubscriptionId });
      
      const result = await cancelStripeSubscription(
        subscription.stripeSubscriptionId,
        userId,
        'account_deletion'
      );
      
      if (result.success) {
        logger.info('Stripe subscription cancelled successfully', { userId });
      } else {
        logger.warn('Stripe subscription cancellation failed', { userId, error: result.error });
      }
      
      return result;
    } else if (provider === 'apple' || provider === 'google') {
      // For Apple/Google, mark as cancelled in Firestore
      // User must cancel through device settings to stop billing
      logger.info(`Marking ${provider} subscription as cancelled in Firestore`, { userId, provider });
      
      await admin.firestore().collection('users').doc(userId).update({
        'subscription.status': 'cancelled',
        'subscription.cancelledAt': new Date().toISOString(),
        'subscription.cancellationReason': 'account_deletion',
      });

      logger.info(
        `${provider} subscription marked as cancelled. User should cancel via device settings to stop billing.`,
        { userId, provider }
      );
      
      return { success: true };
    } else {
      logger.info('Unknown or no subscription provider, skipping cancellation', { userId, provider });
      return { success: true };
    }

  } catch (error) {
    logger.error('Error cancelling subscription', { userId, error });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Main Cloud Function for account deletion
 * 
 * Security: Only authenticated users can delete their own account
 * Requires confirmation text "DELETE MY ACCOUNT" to prevent accidental deletion
 * 
 * Uses partial error handling - continues deletion even if some steps fail
 * Returns success if Auth OR Firestore deletion succeeds
 */
export const deleteUserAccount = onCall<DeleteAccountRequest, Promise<DeleteAccountResponse>>(
  {
    region: 'us-central1',
    timeoutSeconds: 540, // 9 minutes for large accounts with many documents
    memory: '1GiB', // More memory for processing large accounts
    secrets: [stripeSecretKey, intercomAccessToken], // Required for Stripe & Intercom
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = request.auth.uid;
    const { confirmationText } = request.data;

    logger.info('Account deletion requested', { userId });

    // Verify confirmation text
    if (confirmationText !== 'DELETE MY ACCOUNT') {
      logger.warn('Account deletion rejected: invalid confirmation text', { 
        userId, 
        providedText: confirmationText 
      });
      throw new HttpsError(
        'failed-precondition',
        'Confirmation text must be "DELETE MY ACCOUNT"'
      );
    }

    // Track success of each step
    const errors: string[] = [];
    let subscriptionCancelled = false;
    let intercomDeleted = false;
    let firestoreDeleted = false;
    let authDeleted = false;

    // Step 1: Cancel active subscription (if any)
    try {
      const subscriptionResult = await cancelUserSubscription(userId);
      
      if (subscriptionResult.success) {
        subscriptionCancelled = true;
        logger.info('Subscription cancelled successfully', { userId });
      } else {
        errors.push(`Subscription cancellation failed: ${subscriptionResult.error}`);
        logger.warn('Continuing despite subscription error', { userId, error: subscriptionResult.error });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Subscription error: ${errorMessage}`);
      logger.warn('Continuing despite subscription error', { userId, error });
    }

    // Step 2: Delete user from Intercom
    try {
      const intercomResult = await deleteFromIntercom(userId);
      
      if (intercomResult.success) {
        intercomDeleted = true;
        logger.info('Intercom data deleted successfully', { userId });
      } else {
        errors.push(`Intercom deletion failed: ${intercomResult.error}`);
        logger.warn('Continuing despite Intercom error', { userId, error: intercomResult.error });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Intercom error: ${errorMessage}`);
      logger.warn('Continuing despite Intercom error', { userId, error });
    }

    // Step 3: Delete all Firestore data using recursiveDelete
    try {
      logger.info('Starting Firestore data deletion', { userId });
      
      const db = admin.firestore();
      const bulkWriter = db.bulkWriter();
      const deleteErrors: Array<{path: string; error: string}> = [];

      // Configure error handler for BulkWriter
      bulkWriter.onWriteError((error) => {
        deleteErrors.push({
          path: error.documentRef.path,
          error: error.message || 'Unknown error'
        });
        
        if (error.failedAttempts < 3) {
          logger.warn('Retrying delete', { 
            path: error.documentRef.path, 
            attempt: error.failedAttempts 
          });
          return true; // Retry
        }
        
        logger.error('Failed to delete after retries', { 
          path: error.documentRef.path,
          error: error.message || 'Unknown error'
        });
        return false; // Don't retry anymore
      });

      // Use Firebase's native recursiveDelete - automatically handles all subcollections
      await db.recursiveDelete(db.doc(`users/${userId}`), bulkWriter);
      await bulkWriter.close();

      if (deleteErrors.length > 0) {
        errors.push(`Failed to delete ${deleteErrors.length} documents`);
        logger.warn('Some Firestore deletions failed', { userId, deleteErrors });
        // Still mark as partially deleted
        firestoreDeleted = true;
      } else {
        firestoreDeleted = true;
        logger.info('Firestore data deleted successfully', { userId });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Firestore deletion error: ${errorMessage}`);
      logger.error('Firestore deletion failed', { userId, error });
    }

    // Step 4: Delete Firebase Auth account
    try {
      logger.info('Deleting Firebase Auth account', { userId });
      
      await admin.auth().deleteUser(userId);
      authDeleted = true;
      
      logger.info('Firebase Auth account deleted successfully', { userId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Auth deletion error: ${errorMessage}`);
      logger.error('Auth deletion failed', { userId, error });
    }

    // Determine overall success
    // Consider it successful if either Auth OR Firestore deletion succeeded
    const success = authDeleted || firestoreDeleted;

    if (success) {
      const message = errors.length > 0 
        ? `Account partially deleted. Some errors occurred: ${errors.join('; ')}`
        : 'Account successfully deleted';
      
      logger.info('Account deletion completed', { 
        userId, 
        success: true,
        subscriptionCancelled,
        intercomDeleted,
        firestoreDeleted,
        authDeleted,
        errorCount: errors.length,
        errors: errors.length > 0 ? errors : undefined
      });

      return {
        success: true,
        error: errors.length > 0 ? message : undefined
      };
    } else {
      const message = `Account deletion failed: ${errors.join('; ')}`;
      
      logger.error('Account deletion completely failed', { userId, errors });

      return {
        success: false,
        error: message
      };
    }
  }
);
