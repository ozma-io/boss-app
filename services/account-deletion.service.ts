import { functions } from '@/constants/firebase.config';
import { DeleteAccountRequest, DeleteAccountResponse } from '@/types';
import { httpsCallable } from 'firebase/functions';
import { logger } from './logger.service';

/**
 * Account Deletion Service
 * 
 * Handles account deletion and data cleanup for user privacy compliance.
 * 
 * TODO: Consider not sending email to analytics services at all instead of anonymizing later.
 * This would be more privacy-friendly and reduce need for post-deletion cleanup.
 * We could implement a "privacy mode" where email is never sent to third-party services.
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
 * TODO: Anonymize user data in Amplitude analytics
 * 
 * Options:
 * 1. Delete user data via Amplitude API (if available)
 * 2. Anonymize user properties (set email to "[deleted]", userId to anonymous ID)
 * 3. Better approach: Don't send email to Amplitude at all initially
 * 
 * Note: Currently we send email on user login via setAmplitudeUserId().
 * Consider implementing privacy mode where email is never sent to analytics.
 * 
 * @param userId - User ID to anonymize
 */
export async function anonymizeAmplitudeData(userId: string): Promise<void> {
  // TODO: Implement Amplitude data anonymization
  logger.info('TODO: Anonymize Amplitude data', { 
    feature: 'AccountDeletion', 
    userId,
    note: 'Consider not sending email to Amplitude at all instead of anonymizing later'
  });
}

/**
 * TODO: Anonymize user data in Intercom
 * 
 * Options:
 * 1. Delete user via Intercom API
 * 2. Anonymize user attributes (name, email, custom attributes)
 * 3. Better approach: Don't send email to Intercom at all initially (privacy mode)
 * 
 * Note: Currently we send email on user login via registerIntercomUser().
 * Consider implementing privacy mode where email is never sent to support system.
 * 
 * @param userId - User ID to anonymize
 */
export async function anonymizeIntercomData(userId: string): Promise<void> {
  // TODO: Implement Intercom data anonymization
  logger.info('TODO: Anonymize Intercom data', { 
    feature: 'AccountDeletion', 
    userId,
    note: 'Consider not sending email to Intercom at all instead of anonymizing later'
  });
}

/**
 * TODO: Anonymize user context in Sentry error logs
 * 
 * Options:
 * 1. Remove user context from Sentry events (if API available)
 * 2. Update user context to anonymous ID
 * 3. Better approach: Don't send email to Sentry at all initially (privacy mode)
 * 
 * Note: Currently logger.service.ts sends user context to Sentry.
 * Consider implementing privacy mode where PII is never sent to error tracking.
 * 
 * @param userId - User ID to anonymize
 */
export async function anonymizeSentryData(userId: string): Promise<void> {
  // TODO: Implement Sentry data anonymization
  logger.info('TODO: Anonymize Sentry data', { 
    feature: 'AccountDeletion', 
    userId,
    note: 'Consider not sending email to Sentry at all instead of anonymizing later'
  });
}

/**
 * TODO: Clean up any stored logs with PII
 * 
 * Options:
 * 1. Scan and remove local logs with user email/PII
 * 2. Clean AsyncStorage/localStorage for any cached user data
 * 3. Better approach: Never log PII in the first place (privacy by design)
 * 
 * Note: Review logging practices to ensure no PII is logged.
 * Consider using user IDs instead of emails in all logs.
 * 
 * @param userId - User ID to clean logs for
 */
export async function cleanupLogData(userId: string): Promise<void> {
  // TODO: Implement log data cleanup
  logger.info('TODO: Clean up log data', { 
    feature: 'AccountDeletion', 
    userId,
    note: 'Consider never logging PII instead of cleaning it up later'
  });
}

