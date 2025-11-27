/**
 * Apple App Store Server Notifications V2 Webhook
 * 
 * Handles real-time notifications from Apple about subscription events
 * including renewals, cancellations, refunds, and more.
 * 
 * Setup: Configure this endpoint in App Store Connect:
 * https://us-central1-<project-id>.cloudfunctions.net/appleServerNotification
 */

import { 
  Environment, 
  SignedDataVerifier,
  JWSTransactionDecodedPayload,
  JWSRenewalInfoDecodedPayload,
} from '@apple/app-store-server-library';
import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { downloadAppleRootCertificates } from './apple-helpers';
import {
  APPLE_APP_ID,
  APPLE_BUNDLE_ID,
} from './constants';
import { logger } from './logger';

/**
 * Find userId by originalTransactionId only (for renewalInfo notifications)
 * 
 * Strategy:
 * 1. Try transaction mapping collection (fast, always available after purchase)
 * 2. Try user subscription field (slower query, may not exist if subscription deleted)
 * 
 * @returns userId or null if not found
 */
async function findUserByTransactionId(originalTransactionId: string): Promise<string | null> {
  // Strategy 1: Check transaction mapping collection
  try {
    const mappingDoc = await admin.firestore()
      .collection('apple_transaction_mapping')
      .doc(originalTransactionId)
      .get();

    if (mappingDoc.exists) {
      const userId = mappingDoc.data()?.userId;
      if (userId) {
        logger.info('Found userId from transaction mapping', {
          userId,
          originalTransactionId,
        });
        return userId;
      }
    }
  } catch (error) {
    logger.warn('Failed to check transaction mapping', {
      error,
      originalTransactionId,
    });
  }

  // Strategy 2: Query users by appleOriginalTransactionId (fallback for old purchases)
  try {
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('subscription.appleOriginalTransactionId', '==', originalTransactionId)
      .limit(1)
      .get();

    if (!usersSnapshot.empty) {
      const userId = usersSnapshot.docs[0].id;
      logger.info('Found userId from user subscription field', {
        userId,
        originalTransactionId,
      });
      return userId;
    }
  } catch (error) {
    logger.warn('Failed to query users by transaction ID', {
      error,
      originalTransactionId,
    });
  }

  // User not found with any strategy
  return null;
}

/**
 * Find userId by Apple transaction using multiple strategies
 * 
 * Strategy:
 * 1. Try appAccountToken (fastest, most reliable)
 * 2. Try transaction mapping collection (fast, always available after purchase)
 * 3. Try user subscription field (slower query, may not exist if subscription deleted)
 * 
 * @returns userId or null if not found
 */
async function findUserByAppleTransaction(
  originalTransactionId: string,
  transactionInfo: JWSTransactionDecodedPayload
): Promise<string | null> {
  // Strategy 1: Check appAccountToken (added in new purchases)
  if (transactionInfo.appAccountToken) {
    logger.info('Found userId from appAccountToken', {
      userId: transactionInfo.appAccountToken,
      originalTransactionId,
    });
    return transactionInfo.appAccountToken;
  }

  // Strategy 2 & 3: Use the fallback function
  return findUserByTransactionId(originalTransactionId);
}

/**
 * Process subscription renewal event
 */
async function handleDidRenew(
  originalTransactionId: string,
  transactionInfo: JWSTransactionDecodedPayload,
  environment: string
): Promise<void> {
  try {
    // Find user using multiple strategies (appAccountToken, mapping, query)
    const userId = await findUserByAppleTransaction(originalTransactionId, transactionInfo);

    if (!userId) {
      logger.warn('User not found for renewal notification', {
        originalTransactionId,
        transactionId: transactionInfo.transactionId,
        productId: transactionInfo.productId,
        environment,
        expiresDate: transactionInfo.expiresDate 
          ? new Date(transactionInfo.expiresDate).toISOString() 
          : null,
        purchaseDate: transactionInfo.purchaseDate 
          ? new Date(transactionInfo.purchaseDate).toISOString() 
          : null,
        offerType: transactionInfo.offerType,
        isUpgraded: transactionInfo.isUpgraded,
        bundleId: transactionInfo.bundleId,
        appAccountToken: transactionInfo.appAccountToken || null,
      });
      return;
    }

    // Update subscription with new expiration date
    const expiresDate = transactionInfo.expiresDate 
      ? new Date(transactionInfo.expiresDate).toISOString()
      : null;

    await admin.firestore().collection('users').doc(userId).update({
      'subscription.status': 'active',
      'subscription.currentPeriodEnd': expiresDate,
      'subscription.appleEnvironment': environment,
      'subscription.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
      'subscription.lastVerifiedAt': admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info('Subscription renewed successfully', {
      userId,
      originalTransactionId,
      transactionId: transactionInfo.transactionId,
      productId: transactionInfo.productId,
      environment,
      expiresDate,
    });
  } catch (error) {
    logger.error('Failed to process renewal', { error, originalTransactionId });
  }
}

/**
 * Process subscription expiration event
 */
async function handleExpired(
  originalTransactionId: string,
  transactionInfo: JWSTransactionDecodedPayload
): Promise<void> {
  try {
    // Find user using multiple strategies
    const userId = await findUserByAppleTransaction(originalTransactionId, transactionInfo);

    if (!userId) {
      logger.warn('User not found for expiration notification', {
        originalTransactionId,
        transactionId: transactionInfo.transactionId,
        productId: transactionInfo.productId,
        expiresDate: transactionInfo.expiresDate 
          ? new Date(transactionInfo.expiresDate).toISOString() 
          : null,
        purchaseDate: transactionInfo.purchaseDate 
          ? new Date(transactionInfo.purchaseDate).toISOString() 
          : null,
        bundleId: transactionInfo.bundleId,
        appAccountToken: transactionInfo.appAccountToken || null,
      });
      return;
    }

    // Mark subscription as expired
    await admin.firestore().collection('users').doc(userId).update({
      'subscription.status': 'expired',
      'subscription.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info('Subscription expired', {
      userId,
      originalTransactionId,
    });
  } catch (error) {
    logger.error('Failed to process expiration', { error, originalTransactionId });
  }
}

/**
 * Process refund event
 */
async function handleRefund(
  originalTransactionId: string,
  transactionInfo: JWSTransactionDecodedPayload
): Promise<void> {
  try {
    // Find user using multiple strategies
    const userId = await findUserByAppleTransaction(originalTransactionId, transactionInfo);

    if (!userId) {
      logger.warn('User not found for refund notification', {
        originalTransactionId,
        transactionId: transactionInfo.transactionId,
        productId: transactionInfo.productId,
        revocationDate: transactionInfo.revocationDate 
          ? new Date(transactionInfo.revocationDate).toISOString() 
          : null,
        revocationReason: transactionInfo.revocationReason,
        purchaseDate: transactionInfo.purchaseDate 
          ? new Date(transactionInfo.purchaseDate).toISOString() 
          : null,
        bundleId: transactionInfo.bundleId,
        appAccountToken: transactionInfo.appAccountToken || null,
      });
      return;
    }

    // Mark subscription as expired due to refund
    const revocationDate = transactionInfo.revocationDate 
      ? new Date(transactionInfo.revocationDate).toISOString()
      : new Date().toISOString();

    await admin.firestore().collection('users').doc(userId).update({
      'subscription.status': 'expired',
      'subscription.appleRevocationDate': revocationDate,
      'subscription.appleRevocationReason': transactionInfo.revocationReason || null,
      'subscription.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info('Subscription refunded', {
      userId,
      originalTransactionId,
      revocationDate,
    });
  } catch (error) {
    logger.error('Failed to process refund', { error, originalTransactionId });
  }
}

/**
 * Process failed renewal event (billing retry period)
 */
async function handleDidFailToRenew(
  originalTransactionId: string,
  transactionInfo: JWSTransactionDecodedPayload
): Promise<void> {
  try {
    // Find user using multiple strategies
    const userId = await findUserByAppleTransaction(originalTransactionId, transactionInfo);

    if (!userId) {
      logger.warn('User not found for failed renewal notification', {
        originalTransactionId,
        transactionId: transactionInfo.transactionId,
        productId: transactionInfo.productId,
        expiresDate: transactionInfo.expiresDate 
          ? new Date(transactionInfo.expiresDate).toISOString() 
          : null,
        purchaseDate: transactionInfo.purchaseDate 
          ? new Date(transactionInfo.purchaseDate).toISOString() 
          : null,
        bundleId: transactionInfo.bundleId,
        appAccountToken: transactionInfo.appAccountToken || null,
      });
      return;
    }

    // Keep subscription active during billing retry period
    // Apple will continue to retry the payment
    await admin.firestore().collection('users').doc(userId).update({
      'subscription.status': 'active',
      'subscription.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info('Subscription in billing retry period (payment failed)', {
      userId,
      originalTransactionId,
    });
  } catch (error) {
    logger.error('Failed to process failed renewal', { error, originalTransactionId });
  }
}

/**
 * Process grace period expiration event
 */
async function handleGracePeriodExpired(
  originalTransactionId: string,
  transactionInfo: JWSTransactionDecodedPayload
): Promise<void> {
  try {
    // Find user using multiple strategies
    const userId = await findUserByAppleTransaction(originalTransactionId, transactionInfo);

    if (!userId) {
      logger.warn('User not found for grace period expiration', {
        originalTransactionId,
        transactionId: transactionInfo.transactionId,
        productId: transactionInfo.productId,
        expiresDate: transactionInfo.expiresDate 
          ? new Date(transactionInfo.expiresDate).toISOString() 
          : null,
        purchaseDate: transactionInfo.purchaseDate 
          ? new Date(transactionInfo.purchaseDate).toISOString() 
          : null,
        bundleId: transactionInfo.bundleId,
        appAccountToken: transactionInfo.appAccountToken || null,
      });
      return;
    }

    // Mark subscription as expired - user loses access
    await admin.firestore().collection('users').doc(userId).update({
      'subscription.status': 'expired',
      'subscription.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info('Grace period expired, subscription now expired', {
      userId,
      originalTransactionId,
    });
  } catch (error) {
    logger.error('Failed to process grace period expiration', { error, originalTransactionId });
  }
}

/**
 * Process renewal status change event (auto-renew toggled on/off)
 */
async function handleDidChangeRenewalStatus(
  originalTransactionId: string,
  renewalInfo: JWSRenewalInfoDecodedPayload
): Promise<void> {
  try {
    // Find user using transaction ID lookup
    const userId = await findUserByTransactionId(originalTransactionId);

    if (!userId) {
      logger.warn('User not found for renewal status change', {
        originalTransactionId,
        productId: renewalInfo?.productId,
        autoRenewStatus: renewalInfo?.autoRenewStatus,
        expirationIntent: renewalInfo?.expirationIntent,
        isInBillingRetryPeriod: renewalInfo?.isInBillingRetryPeriod,
      });
      return;
    }

    // Get user data to check current subscription status
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();

    // Check if auto-renew is enabled (1) or disabled (0)
    const autoRenewEnabled = renewalInfo?.autoRenewStatus === 1;

    // Update status: if auto-renew is off and subscription is active, mark as 'cancelled'
    // but keep the subscription active until the current period ends
    let newStatus = userData?.subscription?.status || 'active';
    
    if (!autoRenewEnabled && (newStatus === 'active' || newStatus === 'trial')) {
      newStatus = 'cancelled';
      logger.info('User disabled auto-renew, marking as cancelled', {
        userId,
        originalTransactionId,
      });
    } else if (autoRenewEnabled && newStatus === 'cancelled') {
      newStatus = 'active';
      logger.info('User re-enabled auto-renew, marking as active', {
        userId,
        originalTransactionId,
      });
    }

    await admin.firestore().collection('users').doc(userId).update({
      'subscription.status': newStatus,
      'subscription.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info('Renewal status changed', {
      userId,
      originalTransactionId,
      autoRenewEnabled,
      newStatus,
    });
  } catch (error) {
    logger.error('Failed to process renewal status change', { error, originalTransactionId });
  }
}

/**
 * Main webhook handler for App Store Server Notifications V2
 */
export const appleServerNotification = onRequest(
  {
    region: 'us-central1',
    // No secrets needed - Apple notifications are verified using public root certificates
  },
  async (req, res) => {
    try {
      // Only accept POST requests
      if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
      }

      const { signedPayload } = req.body;

      if (!signedPayload) {
        logger.warn('Missing signedPayload in notification', {});
        res.status(400).send('Missing signedPayload');
        return;
      }

      logger.info('Received Apple notification', {
        hasPayload: !!signedPayload,
      });

      // Download Apple root certificates
      const rootCAs = await downloadAppleRootCertificates();
      
      if (rootCAs.length === 0) {
        throw new Error('Failed to download Apple root certificates');
      }

      // Try to verify notification with Production environment first, 
      // then fallback to Sandbox if that fails
      // (Apple sends both Production and Sandbox notifications to the same webhook URL)
      let decodedNotification;
      let verifier: SignedDataVerifier;
      let verificationEnvironment: string;

      try {
        // Try Production first
        verifier = new SignedDataVerifier(
          rootCAs,
          true, // Enable online checks
          Environment.PRODUCTION,
          APPLE_BUNDLE_ID,
          APPLE_APP_ID
        );
        
        decodedNotification = await verifier.verifyAndDecodeNotification(signedPayload);
        verificationEnvironment = 'Production';
        
        logger.info('Notification verified with Production environment', {});
      } catch (productionError: unknown) {
        // If Production verification failed, try Sandbox
        const errorMessage = productionError instanceof Error ? productionError.message : 'Unknown error';
        const errorStatus = (productionError as { status?: number }).status;
        
        logger.info('Production verification failed, trying Sandbox', { 
          productionError: errorMessage,
          status: errorStatus,
        });
        
        try {
          verifier = new SignedDataVerifier(
            rootCAs,
            true, // Enable online checks
            Environment.SANDBOX,
            APPLE_BUNDLE_ID,
            APPLE_APP_ID
          );
          
          decodedNotification = await verifier.verifyAndDecodeNotification(signedPayload);
          verificationEnvironment = 'Sandbox';
          
          logger.info('Notification verified with Sandbox environment', {});
        } catch (sandboxError: unknown) {
          // Both verifications failed
          const sandboxErrorStatus = (sandboxError as { status?: number }).status;
          
          logger.error('Failed to verify notification with both environments', {
            productionStatus: errorStatus,
            sandboxStatus: sandboxErrorStatus,
          });
          throw new Error('Failed to verify notification with both Production and Sandbox environments');
        }
      }

      if (!decodedNotification) {
        throw new Error('Failed to decode notification');
      }

      logger.info('Notification verified and decoded', {
        notificationType: decodedNotification.notificationType,
        subtype: decodedNotification.subtype,
        environment: verificationEnvironment,
      });

      // Extract transaction info from the notification data
      const notificationData = decodedNotification.data;
      const signedTransactionInfo = notificationData?.signedTransactionInfo;

      if (!signedTransactionInfo) {
        logger.warn('No transaction info in notification', {
          notificationType: decodedNotification.notificationType,
        });
        res.status(200).send('OK');
        return;
      }

      // Decode the signed transaction
      const transactionInfo = await verifier.verifyAndDecodeTransaction(signedTransactionInfo);
      
      if (!transactionInfo) {
        throw new Error('Failed to decode transaction info');
      }

      const originalTransactionId = transactionInfo.originalTransactionId;
      const notificationType = decodedNotification.notificationType;

      // Validate required transaction ID
      if (!originalTransactionId) {
        logger.warn('Missing originalTransactionId in transaction', { notificationType });
        res.status(200).send('OK');
        return;
      }

      // Process based on notification type
      switch (notificationType) {
        case 'DID_RENEW':
          await handleDidRenew(originalTransactionId, transactionInfo, verificationEnvironment);
          break;

        case 'EXPIRED':
          await handleExpired(originalTransactionId, transactionInfo);
          break;

        case 'REFUND':
          await handleRefund(originalTransactionId, transactionInfo);
          break;

        case 'DID_FAIL_TO_RENEW':
          await handleDidFailToRenew(originalTransactionId, transactionInfo);
          break;

        case 'GRACE_PERIOD_EXPIRED':
          await handleGracePeriodExpired(originalTransactionId, transactionInfo);
          break;

        case 'DID_CHANGE_RENEWAL_STATUS': {
          // This notification type includes renewalInfo, not just transactionInfo
          const signedRenewalInfo = notificationData?.signedRenewalInfo;
          if (signedRenewalInfo) {
            const renewalInfo = await verifier.verifyAndDecodeRenewalInfo(signedRenewalInfo);
            await handleDidChangeRenewalStatus(originalTransactionId, renewalInfo);
          } else {
            logger.warn('Missing renewalInfo in DID_CHANGE_RENEWAL_STATUS notification', {
              originalTransactionId,
            });
          }
          break;
        }

        // TODO: Add handlers for other notification types as needed:
        // - SUBSCRIBED
        // - OFFER_REDEEMED
        // - PRICE_INCREASE
        // - REFUND_DECLINED
        // - RENEWAL_EXTENDED
        // - REVOKE
        // - TEST (for testing webhooks)
        
        default:
          logger.info('Unhandled notification type', {
            notificationType,
            subtype: decodedNotification.subtype,
            originalTransactionId,
          });
      }

      // Always return 200 to acknowledge receipt
      res.status(200).send('OK');
    } catch (error) {
      logger.error('Failed to process Apple notification', { error });
      
      // Return 200 even on error to prevent Apple from retrying
      // We've logged the error for investigation
      res.status(200).send('OK');
    }
  }
);

