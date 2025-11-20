import { functions } from '@/constants/firebase.config';
import { DeleteAccountRequest, DeleteAccountResponse } from '@/types';
import { httpsCallable } from 'firebase/functions';
import { logger } from './logger.service';

/**
 * Account Deletion Service
 * 
 * Handles account deletion and data cleanup for user privacy compliance.
 * 
 * Privacy by Design: We do NOT send email to analytics (Amplitude, Sentry) or AI (OpenAI).
 * Only User ID is sent, eliminating need for post-deletion anonymization.
 * 
 * Email is only sent to:
 * - Intercom (for support messaging) - requires manual cleanup via Intercom API
 * - Facebook Conversions API (hashed, for attribution) - only when user consents to tracking
 */

/**
 * Delete user account and all associated data
 * 
 * This will:
 * 1. Cancel active subscriptions (Stripe/Apple/Google)
 * 2. Delete all Firestore data (user profile, bosses, entries, chats)
 * 3. Delete Firebase Authentication account
 * 4. User will be automatically signed out after deletion
 * 
 * @param confirmationText - Must be "DELETE MY ACCOUNT" for safety
 * @returns Promise with success status
 */
export async function deleteAccount(confirmationText: string): Promise<DeleteAccountResponse> {
  try {
    logger.info('Calling deleteUserAccount Cloud Function', { feature: 'AccountDeletion' });

    const deleteUserAccount = httpsCallable<DeleteAccountRequest, DeleteAccountResponse>(
      functions,
      'deleteUserAccount'
    );

    const result = await deleteUserAccount({ confirmationText });

    if (result.data.success) {
      logger.info('Account deletion completed successfully', { feature: 'AccountDeletion' });
    } else {
      logger.error('Account deletion failed', { 
        feature: 'AccountDeletion', 
        error: result.data.error 
      });
    }

    return result.data;
  } catch (error) {
    logger.error('Failed to call deleteUserAccount Cloud Function', {
      feature: 'AccountDeletion',
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete account',
    };
  }
}

/**
 * Amplitude data cleanup
 * 
 * NOT NEEDED: We implement Privacy by Design - email is never sent to Amplitude.
 * Only User ID is tracked, so no PII cleanup required after account deletion.
 * Amplitude will automatically stop receiving events after Firebase Auth account is deleted.
 */

/**
 * TODO: Delete user data from Intercom
 * 
 * We intentionally send email to Intercom for support messaging functionality
 * (to send unread conversations via email). This requires manual cleanup on account deletion.
 * 
 * Implementation options:
 * 1. Use Intercom API to delete user: DELETE /users/{user_id}
 * 2. Use Intercom API to archive user: POST /users/{user_id}/archive
 * 
 * @param userId - User ID to delete from Intercom
 */
export async function deleteIntercomData(userId: string): Promise<void> {
  // TODO: Implement Intercom user deletion via API
  logger.info('TODO: Delete Intercom user data via API', { 
    feature: 'AccountDeletion', 
    userId,
    note: 'Use Intercom REST API to delete or archive user'
  });
}

/**
 * Sentry data cleanup
 * 
 * NOT NEEDED: We implement Privacy by Design - email is never sent to Sentry.
 * Only User ID is tracked in error logs, so no PII cleanup required after account deletion.
 */

/**
 * Facebook Conversions API data
 * 
 * Email is sent to Facebook (hashed with SHA-256) but ONLY when user consents to tracking
 * (advertiserTrackingEnabled = true). Facebook handles data retention per their privacy policy.
 * No manual cleanup needed as Facebook automatically respects user consent flag.
 */

