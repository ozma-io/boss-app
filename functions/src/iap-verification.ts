/**
 * In-App Purchase Verification
 * 
 * Cloud Function for verifying Apple and Google Play purchases
 * Handles Stripe-to-IAP migration automatically
 */

import { AppStoreServerAPIClient, Environment, ReceiptUtility, SignedDataVerifier } from '@apple/app-store-server-library';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { google } from 'googleapis';
import Stripe from 'stripe';
import { downloadAppleRootCertificates } from './apple-helpers';
import {
  APPLE_APP_ID,
  APPLE_APP_STORE_ISSUER_ID,
  APPLE_APP_STORE_KEY_ID,
  APPLE_BUNDLE_ID,
  GOOGLE_PLAY_PACKAGE_NAME,
} from './constants';
import { logger } from './logger';

// Define secrets using Cloud Functions v2 API
const applePrivateKey = defineSecret('APPLE_APP_STORE_PRIVATE_KEY');
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const googleServiceAccountKey = defineSecret('GOOGLE_SERVICE_ACCOUNT_KEY');

// Note: APPLE_APP_STORE_KEY_ID and APPLE_APP_STORE_ISSUER_ID are not secrets,
// they are public identifiers stored in constants.ts

/**
 * Retry helper with exponential backoff for Apple API calls
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 500
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        logger.info('Apple API call failed, retrying...', { 
          attempt, 
          maxRetries, 
          delayMs,
          error: lastError.message,
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  
  logger.error('Apple API call failed after all retries', { 
    maxRetries,
    error: lastError,
  });
  throw lastError;
}

interface VerifyIAPRequest {
  receipt: string;
  productId: string;
  platform: 'ios' | 'android';
  tier: string;
  billingPeriod: string;
}

interface VerifyIAPResponse {
  success: boolean;
  subscription?: {
    status: string;
    tier: string;
    billingPeriod: string;
    provider: string;
    transactionId: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEnd?: string;
    revocationDate?: string;
    revocationReason?: number;
  };
  environment?: 'Sandbox' | 'Production';
  error?: string;
  migrated?: boolean;
}

interface CancelSubscriptionResponse {
  success: boolean;
  currentPeriodEnd?: string;
  error?: string;
}

/**
 * Verify Apple In-App Purchase receipt
 */
async function verifyAppleReceipt(
  receipt: string,
  productId: string,
  tier: string,
  billingPeriod: string
): Promise<VerifyIAPResponse> {
  try {
    // Get Apple private key from secret (trim to remove any whitespace)
    const privateKey = applePrivateKey.value().trim();

    if (!privateKey) {
      throw new Error('Apple App Store private key not configured');
    }

    // Start with a best-guess environment for API client initialization
    // Will be updated based on actual transaction data after verification
    let environment = receipt.includes('Sandbox') ? Environment.SANDBOX : Environment.PRODUCTION;

    // Initialize App Store Server API Client
    const client = new AppStoreServerAPIClient(
      privateKey,
      APPLE_APP_STORE_KEY_ID,
      APPLE_APP_STORE_ISSUER_ID,
      APPLE_BUNDLE_ID,
      environment
    );

    // Extract transaction ID from receipt
    const receiptUtil = new ReceiptUtility();
    const extractedTransactionId = receiptUtil.extractTransactionIdFromAppReceipt(receipt);
    
    if (!extractedTransactionId) {
      throw new Error('Invalid receipt format - could not extract transaction ID');
    }

    // Get transaction info from Apple (returns signed transaction string)
    // Wrapped in retry logic to handle temporary network issues
    const transactionInfoResponse = await retryWithBackoff(
      () => client.getTransactionInfo(extractedTransactionId),
      3, // maxRetries
      500 // initialDelayMs
    );
    
    if (!transactionInfoResponse || !transactionInfoResponse.signedTransactionInfo) {
      throw new Error('Failed to get transaction info from Apple');
    }

    // Download Apple root certificates for verification
    const rootCAs = await downloadAppleRootCertificates();
    
    if (rootCAs.length === 0) {
      throw new Error('Failed to download Apple root certificates');
    }

    // Create verifier to decode and verify the JWS
    // App Apple ID is required for production, optional for sandbox
    const appAppleId = environment === Environment.PRODUCTION ? APPLE_APP_ID : undefined;
    
    const verifier = new SignedDataVerifier(
      rootCAs,
      true, // Enable online checks
      environment,
      APPLE_BUNDLE_ID,
      appAppleId
    );

    // Decode and verify the signed transaction
    const decodedTransaction = await verifier.verifyAndDecodeTransaction(
      transactionInfoResponse.signedTransactionInfo
    );
    
    if (!decodedTransaction) {
      throw new Error('Failed to decode transaction from Apple');
    }

    // Use the actual environment from decoded transaction
    // This is the authoritative source, overrides our initial guess
    if (decodedTransaction.environment) {
      const actualEnvironment = decodedTransaction.environment === 'Sandbox' ? Environment.SANDBOX : Environment.PRODUCTION;
      if (actualEnvironment !== environment) {
        logger.info('Using actual environment from transaction (different from initial guess)', {
          initialGuess: environment === Environment.SANDBOX ? 'Sandbox' : 'Production',
          actualEnvironment: decodedTransaction.environment,
        });
        environment = actualEnvironment;
      }
    } else {
      // Fallback: if environment not in transaction, log warning
      logger.warn('Transaction missing environment field, using initial guess', {
        environment: environment === Environment.SANDBOX ? 'Sandbox' : 'Production',
      });
    }

    // Extract real transaction details from decoded data
    const originalTransactionId = decodedTransaction.originalTransactionId;
    const transactionId = decodedTransaction.transactionId;
    const expiresDate = decodedTransaction.expiresDate ? new Date(decodedTransaction.expiresDate) : null;
    const purchaseDate = decodedTransaction.purchaseDate ? new Date(decodedTransaction.purchaseDate) : new Date();
    const offerType = decodedTransaction.offerType;
    const isUpgraded = decodedTransaction.isUpgraded;
    const revocationDate = decodedTransaction.revocationDate ? new Date(decodedTransaction.revocationDate) : null;
    const revocationReason = decodedTransaction.revocationReason;
    
    // Get comprehensive subscription status from Apple
    // This provides more accurate status including renewal info, grace period, billing retry
    let renewalInfo: any = null;
    
    if (originalTransactionId) {
      try {
        const statusResponse = await retryWithBackoff(
          () => client.getAllSubscriptionStatuses(originalTransactionId),
          3,
          500
        );
        
        if (statusResponse && statusResponse.data && statusResponse.data.length > 0) {
          // Find the status for our product
          const productStatus = statusResponse.data.find(
            (item: any) => item.lastTransactions?.[0]?.originalTransactionId === originalTransactionId
          );
          
          if (productStatus) {
            // Decode renewal info if present
            if (productStatus.lastTransactions?.[0]?.signedRenewalInfo) {
              renewalInfo = await verifier.verifyAndDecodeRenewalInfo(
                productStatus.lastTransactions[0].signedRenewalInfo
              );
            }
            
            logger.info('Retrieved subscription status from Apple', {
              originalTransactionId,
              hasRenewalInfo: !!renewalInfo,
            });
          }
        }
      } catch (error) {
        // Don't fail verification if status check fails - log and continue
        logger.warn('Failed to get subscription statuses from Apple', {
          error,
          originalTransactionId,
        });
      }
    }
    
    // Grace period: Apple gives users time to fix payment issues while maintaining access
    // gracePeriodExpiresDate may not be in all library versions, so we use type assertion
    const gracePeriodExpiresDate = (decodedTransaction as any).gracePeriodExpiresDate 
      ? new Date((decodedTransaction as any).gracePeriodExpiresDate) 
      : null;
    
    // Check if this is a trial period - must be introductory offer and not an upgrade
    // offerType: 1 = Introductory offer, 2 = Promotional offer, 3 = Offer code
    const inTrialPeriod = offerType === 1 && !isUpgraded;
    
    // Determine subscription status with improved logic using renewal info
    let status: string;
    const now = new Date();
    
    // Check renewal info for more accurate status
    const autoRenewStatus = renewalInfo?.autoRenewStatus;
    const expirationIntent = renewalInfo?.expirationIntent;
    const isInBillingRetry = renewalInfo?.isInBillingRetryPeriod;
    
    if (revocationDate) {
      // Subscription was refunded
      status = 'expired';
      logger.info('Subscription was revoked/refunded', {
        revocationDate,
        revocationReason,
        transactionId: originalTransactionId || transactionId,
      });
    } else if (isInBillingRetry) {
      // In billing retry - payment failed but subscription still active
      status = 'active';
      logger.info('Subscription in billing retry period', {
        transactionId: originalTransactionId || transactionId,
      });
    } else if (gracePeriodExpiresDate && gracePeriodExpiresDate > now) {
      // In grace period - payment failed but user still has access
      status = 'active';
      logger.info('Subscription in grace period', {
        gracePeriodExpiresDate,
        transactionId: originalTransactionId || transactionId,
      });
    } else if (inTrialPeriod) {
      status = 'trial';
    } else if (expiresDate && expiresDate > now) {
      status = 'active';
    } else if (autoRenewStatus === 0 || expirationIntent) {
      // Auto-renew is off or there's an expiration intent
      status = 'cancelled';
      logger.info('Subscription cancelled (auto-renew off)', {
        autoRenewStatus,
        expirationIntent,
        transactionId: originalTransactionId || transactionId,
      });
    } else {
      status = 'expired';
    }

    // Calculate period dates
    const currentPeriodStart = purchaseDate.toISOString();
    const currentPeriodEnd = expiresDate ? expiresDate.toISOString() : new Date(purchaseDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const trialEnd = inTrialPeriod && expiresDate ? expiresDate.toISOString() : undefined;

    return {
      success: true,
      subscription: {
        status,
        tier,
        billingPeriod,
        provider: 'apple',
        transactionId: originalTransactionId || transactionId || extractedTransactionId,
        currentPeriodStart,
        currentPeriodEnd,
        trialEnd,
        revocationDate: revocationDate?.toISOString(),
        revocationReason,
      },
      environment: environment === Environment.SANDBOX ? 'Sandbox' : 'Production',
    };
  } catch (error) {
    logger.error('Apple receipt verification failed', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify Google Play purchase
 */
async function verifyGooglePlayPurchase(
  purchaseToken: string,
  productId: string,
  tier: string,
  billingPeriod: string
): Promise<VerifyIAPResponse> {
  try {
    // Get Google Service Account key from secret
    const serviceAccountKeyJson = googleServiceAccountKey.value().trim();

    if (!serviceAccountKeyJson) {
      throw new Error('Google Service Account key not configured');
    }

    // Parse service account credentials
    const serviceAccountKey = JSON.parse(serviceAccountKeyJson);

    // Initialize Google Play Developer API client with service account
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const androidPublisher = google.androidpublisher({
      version: 'v3',
      auth,
    });

    // Get subscription details from Google Play
    // Using subscriptionsv2 API for enhanced subscription info
    const response = await retryWithBackoff(
      async () => {
        return await androidPublisher.purchases.subscriptionsv2.get({
          packageName: GOOGLE_PLAY_PACKAGE_NAME,
          token: purchaseToken,
        });
      },
      3,
      500
    );

    if (!response || !response.data) {
      throw new Error('Failed to get subscription info from Google Play');
    }

    const subscription = response.data;

    // Extract subscription status and dates
    const subscriptionState = subscription.subscriptionState;
    const lineItems = subscription.lineItems || [];
    
    if (lineItems.length === 0) {
      throw new Error('No line items found in subscription');
    }

    const lineItem = lineItems[0];
    const expiryTime = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
    const startTime = subscription.startTime ? new Date(subscription.startTime) : new Date();
    
    // Check for trial period
    const offerDetails = lineItem.offerDetails;
    const isInTrialPeriod = offerDetails?.basePlanId?.includes('trial') || 
                            offerDetails?.offerTags?.includes('trial') ||
                            false;

    // Determine subscription status based on Google Play state
    let status: string;
    const now = new Date();

    // Google Play subscription states:
    // SUBSCRIPTION_STATE_ACTIVE (1) - Active subscription
    // SUBSCRIPTION_STATE_CANCELED (2) - Canceled but still valid until expiry
    // SUBSCRIPTION_STATE_IN_GRACE_PERIOD (3) - Payment issue, user still has access
    // SUBSCRIPTION_STATE_ON_HOLD (4) - Payment issue, user lost access
    // SUBSCRIPTION_STATE_PAUSED (5) - Subscription paused by user
    // SUBSCRIPTION_STATE_EXPIRED (6) - Subscription expired

    switch (subscriptionState) {
      case 'SUBSCRIPTION_STATE_ACTIVE':
        status = isInTrialPeriod ? 'trial' : 'active';
        break;
      
      case 'SUBSCRIPTION_STATE_CANCELED':
        // Canceled but still valid until expiry date
        if (expiryTime && expiryTime > now) {
          status = 'cancelled';
        } else {
          status = 'expired';
        }
        break;
      
      case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
        // Payment failed but user still has access
        status = 'active';
        break;
      
      case 'SUBSCRIPTION_STATE_ON_HOLD':
      case 'SUBSCRIPTION_STATE_PAUSED':
        // Payment failed and user lost access, or paused
        status = 'expired';
        break;
      
      case 'SUBSCRIPTION_STATE_EXPIRED':
        status = 'expired';
        break;
      
      case 'SUBSCRIPTION_STATE_PENDING':
        // Subscription purchase is pending (e.g., bank transfer)
        status = 'pending';
        break;
      
      default:
        // Unknown state, treat as expired for safety
        logger.warn('Unknown Google Play subscription state', {
          subscriptionState,
          purchaseToken,
        });
        status = 'expired';
    }

    // Calculate period dates
    const currentPeriodStart = startTime.toISOString();
    const currentPeriodEnd = expiryTime 
      ? expiryTime.toISOString() 
      : new Date(startTime.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const trialEnd = isInTrialPeriod && expiryTime ? expiryTime.toISOString() : undefined;

    // Get cancellation details if applicable
    const canceledStateContext = subscription.canceledStateContext;
    const cancelReason = canceledStateContext?.userInitiatedCancellation ? 'user' : 
                        canceledStateContext?.systemInitiatedCancellation ? 'system' : 
                        undefined;

    return {
      success: true,
      subscription: {
        status,
        tier,
        billingPeriod,
        provider: 'google',
        transactionId: purchaseToken,
        currentPeriodStart,
        currentPeriodEnd,
        trialEnd,
        ...(cancelReason && { cancellationReason: cancelReason }),
      },
    };
  } catch (error) {
    logger.error('Google Play purchase verification failed', { error, purchaseToken });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Shared function to cancel a Stripe subscription
 * Used for both manual cancellation and auto-migration
 */
async function cancelStripeSubscription(
  stripeSubscriptionId: string,
  userId: string,
  reason: 'migration' | 'user_request'
): Promise<{ success: boolean; currentPeriodEnd?: string; error?: string }> {
  try {
    const stripeKey = stripeSecretKey.value().trim();
    
    if (!stripeKey) {
      const error = 'Stripe secret key not configured';
      logger.warn(error, { userId });
      return { success: false, error };
    }

    // Initialize Stripe with latest API version
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-10-29.clover',
    });

    // Retrieve subscription status from Stripe first
    let stripeSubscription: Stripe.Subscription;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    } catch (error) {
      logger.warn('Failed to retrieve Stripe subscription', {
        error,
        userId,
        stripeSubscriptionId,
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to retrieve subscription'
      };
    }

    // Only cancel if subscription is in a cancellable state
    if (stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing') {
      // Cancel Stripe subscription with proration (refund unused time)
      await stripe.subscriptions.cancel(stripeSubscriptionId, {
        prorate: true,
      });

      const currentPeriodEnd = (stripeSubscription as any).current_period_end 
        ? new Date((stripeSubscription as any).current_period_end * 1000).toISOString()
        : undefined;

      logger.info(`Cancelled Stripe subscription - reason: ${reason}`, {
        userId,
        stripeSubscriptionId,
        previousStatus: stripeSubscription.status,
        prorate: true,
        reason,
      });

      // Update Firestore with cancellation metadata
      await admin.firestore().collection('users').doc(userId).update({
        'subscription.status': 'cancelled',
        'subscription.cancelledAt': admin.firestore.FieldValue.serverTimestamp(),
        'subscription.cancellationReason': reason,
        'subscription.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, currentPeriodEnd };
    } else {
      // Subscription already in final state, no need to cancel
      logger.info('Stripe subscription already in final state, skipping cancellation', {
        userId,
        stripeSubscriptionId,
        status: stripeSubscription.status,
      });
      
      return { 
        success: false, 
        error: `Subscription is already ${stripeSubscription.status}`
      };
    }
  } catch (error) {
    logger.error('Failed to cancel Stripe subscription', { error, userId, reason });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Cancel existing Stripe subscription if user is migrating
 */
async function cancelStripeSubscriptionIfExists(userId: string): Promise<boolean> {
  try {
    const stripeKey = stripeSecretKey.value().trim();
    
    if (!stripeKey) {
      logger.warn('Stripe secret key not configured, skipping Stripe cancellation', { userId });
      return false;
    }

    // Get user's current subscription
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData?.subscription) {
      return false;
    }

    const subscription = userData.subscription;

    // Check if user has active Stripe subscription
    if (subscription.provider !== 'stripe' || subscription.status === 'cancelled' || subscription.status === 'expired') {
      return false;
    }

    const stripeSubscriptionId = subscription.stripeSubscriptionId;

    if (!stripeSubscriptionId) {
      return false;
    }

    // Use shared cancellation logic
    const result = await cancelStripeSubscription(stripeSubscriptionId, userId, 'migration');
    return result.success;
  } catch (error) {
    logger.error('Failed to check and cancel Stripe subscription', { error, userId });
    // Don't throw - we still want to process the Apple purchase
    return false;
  }
}

/**
 * Update user subscription in Firestore
 */
async function updateUserSubscription(
  userId: string,
  subscriptionData: VerifyIAPResponse['subscription'],
  productId: string,
  environment: 'Sandbox' | 'Production',
  migrated: boolean
): Promise<void> {
  if (!subscriptionData) {
    throw new Error('No subscription data to update');
  }

  const updateData: any = {
    'subscription.status': subscriptionData.status,
    'subscription.tier': subscriptionData.tier,
    'subscription.billingPeriod': subscriptionData.billingPeriod,
    'subscription.provider': subscriptionData.provider,
    'subscription.currentPeriodStart': subscriptionData.currentPeriodStart,
    'subscription.currentPeriodEnd': subscriptionData.currentPeriodEnd,
    'subscription.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
    'subscription.lastVerifiedAt': admin.firestore.FieldValue.serverTimestamp(),
  };

  // Apple-specific fields
  if (subscriptionData.provider === 'apple') {
    updateData['subscription.appleOriginalTransactionId'] = subscriptionData.transactionId;
    updateData['subscription.appleTransactionId'] = subscriptionData.transactionId;
    updateData['subscription.appleProductId'] = productId;
    updateData['subscription.appleEnvironment'] = environment;
    
    // Revocation tracking (refunds)
    if (subscriptionData.revocationDate) {
      updateData['subscription.appleRevocationDate'] = subscriptionData.revocationDate;
      updateData['subscription.appleRevocationReason'] = subscriptionData.revocationReason;
    }
  }

  // Google Play-specific fields
  if (subscriptionData.provider === 'google') {
    updateData['subscription.googlePurchaseToken'] = subscriptionData.transactionId;
    updateData['subscription.googlePlayProductId'] = productId;
    updateData['subscription.googlePackageName'] = GOOGLE_PLAY_PACKAGE_NAME;
  }

  // Trial period
  if (subscriptionData.trialEnd) {
    updateData['subscription.trialEnd'] = subscriptionData.trialEnd;
  }

  // Migration tracking
  if (migrated) {
    updateData['subscription.migratedFrom'] = 'stripe';
    updateData['subscription.migratedAt'] = admin.firestore.FieldValue.serverTimestamp();
  }

  // Set createdAt if this is a new subscription
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const userData = userDoc.data();
  
  if (!userData?.subscription?.createdAt) {
    updateData['subscription.createdAt'] = admin.firestore.FieldValue.serverTimestamp();
  }

  await admin.firestore().collection('users').doc(userId).update(updateData);

  logger.info('Updated user subscription in Firestore', {
    userId,
    provider: subscriptionData.provider,
    status: subscriptionData.status,
    migrated,
  });
}

/**
 * Main Cloud Function: Verify IAP Purchase
 * 
 * Callable from app with authentication required
 */
export const verifyIAPPurchase = onCall<VerifyIAPRequest, Promise<VerifyIAPResponse>>(
  {
    region: 'us-central1',
    secrets: [applePrivateKey, stripeSecretKey, googleServiceAccountKey],
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = request.auth.uid;
    const { receipt, productId, platform, tier, billingPeriod } = request.data;

    // Validate input
    if (!receipt || !productId || !platform || !tier || !billingPeriod) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    logger.info('Verifying IAP purchase', {
      userId,
      platform,
      productId,
      tier,
      billingPeriod,
    });

    try {
      let verificationResult: VerifyIAPResponse;

      // Verify based on platform
      if (platform === 'ios') {
        verificationResult = await verifyAppleReceipt(receipt, productId, tier, billingPeriod);
      } else if (platform === 'android') {
        verificationResult = await verifyGooglePlayPurchase(receipt, productId, tier, billingPeriod);
      } else {
        throw new HttpsError('invalid-argument', 'Invalid platform');
      }

      if (!verificationResult.success || !verificationResult.subscription) {
        return verificationResult;
      }

      // Cancel Stripe subscription if migrating
      const migrated = await cancelStripeSubscriptionIfExists(userId);

      // Update Firestore
      // For iOS, environment is returned from verifyAppleReceipt
      // For Android, we don't have environment info
      const environmentString = verificationResult.environment || 'Production';
      await updateUserSubscription(
        userId,
        verificationResult.subscription,
        productId,
        environmentString,
        migrated
      );

      return {
        ...verificationResult,
        migrated,
      };
    } catch (error) {
      logger.error('IAP verification failed', { error, userId, platform });
      
      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to verify purchase'
      );
    }
  }
);

/**
 * Cloud Function: Cancel Subscription
 * 
 * Allows users to manually cancel their Stripe subscription
 * Apple/Google subscriptions must be cancelled through native Settings
 */
export const cancelSubscription = onCall<{}, Promise<CancelSubscriptionResponse>>(
  {
    region: 'us-central1',
    secrets: [stripeSecretKey],
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = request.auth.uid;

    logger.info('Manual subscription cancellation requested', { userId });

    try {
      // Get user's current subscription
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User not found');
      }

      const userData = userDoc.data();

      if (!userData?.subscription) {
        return {
          success: false,
          error: 'No active subscription found',
        };
      }

      const subscription = userData.subscription;

      // Only allow cancellation of Stripe subscriptions
      // Apple/Google must be cancelled through native Settings
      if (subscription.provider === 'apple' || subscription.provider === 'google') {
        throw new HttpsError(
          'failed-precondition',
          'Apple and Google subscriptions must be cancelled through your device Settings'
        );
      }

      if (subscription.provider !== 'stripe') {
        return {
          success: false,
          error: 'No subscription provider found',
        };
      }

      // Check if already cancelled or expired
      if (subscription.status === 'cancelled' || subscription.status === 'expired') {
        return {
          success: false,
          error: `Subscription is already ${subscription.status}`,
        };
      }

      const stripeSubscriptionId = subscription.stripeSubscriptionId;

      if (!stripeSubscriptionId) {
        return {
          success: false,
          error: 'No Stripe subscription ID found',
        };
      }

      // Use shared cancellation logic
      const result = await cancelStripeSubscription(stripeSubscriptionId, userId, 'user_request');

      if (result.success) {
        logger.info('Successfully cancelled subscription', { 
          userId, 
          currentPeriodEnd: result.currentPeriodEnd 
        });
      }

      return result;
    } catch (error) {
      logger.error('Subscription cancellation failed', { error, userId });
      
      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to cancel subscription'
      );
    }
  }
);

