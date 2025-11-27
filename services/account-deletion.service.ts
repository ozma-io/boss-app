import { functions } from '@/constants/firebase.config';
import { AnonymizeAccountRequest, AnonymizeAccountResponse } from '@/types';
import { httpsCallable } from 'firebase/functions';
import { logger } from './logger.service';

/**
 * Account Anonymization Service
 * 
 * Handles account anonymization and data cleanup for user privacy compliance.
 * Anonymizes personal data while preserving statistical data for analytics.
 * 
 * Privacy by Design: We do NOT send email to analytics (Amplitude, Sentry) or AI (OpenAI).
 * Only User ID is sent, eliminating need for post-anonymization cleanup.
 * 
 * Email is only sent to:
 * - Intercom (for support messaging) - requires manual cleanup via Intercom API
 * - Facebook Conversions API (hashed, for attribution) - only when user consents to tracking
 */

/**
 * Anonymize user account and remove PII while preserving statistical data
 * 
 * This will:
 * 1. Cancel active subscriptions (Stripe/Apple/Google)
 * 2. Replace email with anonymous UUID+timestamp email
 * 3. Remove PII fields (name, displayName, photoURL, attribution PII)
 * 4. Delete Intercom data
 * 5. Preserve all behavioral/statistical data for analytics
 * 6. Keep subscription data only if cancellation fails (for debugging)
 * 
 * @param confirmationText - Must be "DELETE MY ACCOUNT" for safety
 * @returns Promise with success status and anonymous email
 */
export async function anonymizeAccount(confirmationText: string): Promise<AnonymizeAccountResponse> {
  try {
    logger.info('Calling anonymizeUserAccount Cloud Function', { feature: 'AccountDeletion' });

    const anonymizeUserAccount = httpsCallable<AnonymizeAccountRequest, AnonymizeAccountResponse>(
      functions,
      'anonymizeUserAccount'
    );

    const result = await anonymizeUserAccount({ confirmationText });

    if (result.data.success) {
      logger.info('Account anonymization completed successfully', { 
        feature: 'AccountDeletion',
        anonymousEmail: result.data.anonymousEmail
      });
    } else {
      logger.error('Account anonymization failed', { 
        feature: 'AccountDeletion', 
        error: result.data.error 
      });
    }

    return result.data;
  } catch (error) {
    logger.error('Failed to call anonymizeUserAccount Cloud Function', {
      feature: 'AccountDeletion',
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to anonymize account',
    };
  }
}

/**
 * Amplitude data cleanup
 * 
 * NOT NEEDED: We implement Privacy by Design - email is never sent to Amplitude.
 * Only User ID is tracked, so no PII cleanup required after account anonymization.
 * Amplitude continues receiving events with the same User ID (Firebase UID remains).
 */

/**
 * Intercom data deletion
 * 
 * IMPLEMENTED: User is permanently deleted from Intercom during account anonymization.
 * The deletion is handled by the Cloud Function (functions/src/account-deletion.ts).
 * 
 * Process:
 * 1. Find contact by external_id (Firebase UID)
 * 2. Permanently delete contact via Intercom REST API
 * 
 * We intentionally send email to Intercom for support messaging functionality,
 * so it must be cleaned up when account is anonymized.
 */

/**
 * Sentry data cleanup
 * 
 * NOT NEEDED: We implement Privacy by Design - email is never sent to Sentry.
 * Only User ID is tracked in error logs, so no PII cleanup required after account anonymization.
 */

/**
 * Facebook Conversions API data
 * 
 * Email is sent to Facebook (hashed with SHA-256) but ONLY when user consents to tracking
 * (advertiserTrackingEnabled = true). Facebook handles data retention per their privacy policy.
 * No manual cleanup needed as Facebook automatically respects user consent flag.
 */

