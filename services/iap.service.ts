/**
 * In-App Purchase Service
 * 
 * Handles Apple and Google Play in-app purchases
 * Manages subscription verification and synchronization
 */

import { functions } from '@/constants/firebase.config';
import { IAPProduct, IAPPurchaseResult, UserProfile } from '@/types';
import { doc, getDoc, getFirestore, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import { trackAmplitudeEvent } from './amplitude.service';
import { logger } from './logger.service';

// Conditionally import react-native-iap only on native platforms
let RNIap: typeof import('react-native-iap') | undefined;

if (Platform.OS === 'ios' || Platform.OS === 'android') {
  RNIap = require('react-native-iap');
}

let iapConnection: boolean = false;

/**
 * Initialize IAP connection
 * Should be called on app startup
 */
export async function initializeIAP(): Promise<void> {
  if (iapConnection) {
    return;
  }

  // Check if IAP is available on this platform
  if (!RNIap) {
    logger.info('IAP not available on this platform', { platform: Platform.OS });
    return;
  }

  try {
    // Initialize for both iOS and Android
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await RNIap.initConnection();
      iapConnection = true;
      logger.info('IAP connection initialized', { platform: Platform.OS });

      // Setup purchase update listener
      setupPurchaseListener();
    } else {
      logger.info('IAP not available on this platform', { platform: Platform.OS });
    }
  } catch (error) {
    logger.error('Failed to initialize IAP', { error, platform: Platform.OS });
    throw error;
  }
}

/**
 * End IAP connection
 * Should be called on app shutdown
 */
export async function endIAPConnection(): Promise<void> {
  if (!iapConnection || !RNIap) {
    return;
  }

  try {
    await RNIap.endConnection();
    iapConnection = false;
    logger.info('IAP connection ended', { platform: Platform.OS });
  } catch (error) {
    logger.error('Failed to end IAP connection', { error });
  }
}

/**
 * Setup listener for purchase updates
 */
function setupPurchaseListener(): void {
  if ((Platform.OS !== 'ios' && Platform.OS !== 'android') || !RNIap) {
    return;
  }

  const purchaseUpdateSubscription = RNIap.purchaseUpdatedListener((purchase) => {
    logger.info('Purchase update received', { 
      productId: purchase.productId,
      transactionId: purchase.transactionId,
    });
  });

  const purchaseErrorSubscription = RNIap.purchaseErrorListener((error: any) => {
    // Check if user cancelled the purchase
    if (error.code === 'E_USER_CANCELLED') {
      // User cancellation is not an error - just track to Amplitude
      logger.info('Purchase cancelled by user (listener)', { 
        productId: error.productId,
        errorCode: error.code,
        errorMessage: error.message,
        platform: Platform.OS,
      });
      trackAmplitudeEvent('iap_purchase_cancelled', {
        product_id: error.productId || 'unknown',
        platform: Platform.OS,
      });
    } else {
      // Real error - log to Sentry with enhanced details
      const errorDetails = {
        productId: error.productId,
        platform: Platform.OS,
        errorType: typeof error,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorResponseCode: error?.responseCode,
        errorDebugMessage: error?.debugMessage,
        errorUserInfo: error?.userInfo,
      };

      logger.error('Purchase error (listener)', { 
        ...errorDetails,
        error: error instanceof Error ? error : new Error(JSON.stringify(error, null, 2)),
      });
    }
  });

  // Note: These subscriptions should be cleaned up on app unmount
  // Store them globally if needed for cleanup
}

/**
 * Get available products from store
 * 
 * @param productIds - Array of product IDs to fetch
 * @returns Array of available products with pricing
 */
export async function getAvailableProducts(productIds: string[]): Promise<IAPProduct[]> {
  if (!RNIap) {
    return [];
  }

  if (Platform.OS === 'ios') {
    try {
      if (!iapConnection) {
        await initializeIAP();
      }

      const products = await RNIap.fetchProducts({ skus: productIds, type: 'subs' });

      if (!products || products.length === 0) {
        logger.info('No products available from store', { productIds });
        return [];
      }

      return products.map((product) => {
        const iosProduct = product as import('react-native-iap').ProductSubscriptionIOS;
        return {
          productId: iosProduct.id,
          price: iosProduct.displayPrice,
          currency: iosProduct.currency,
          title: iosProduct.title,
          description: iosProduct.description,
        };
      });
    } catch (error) {
      logger.error('Failed to get available products', { error, productIds });
      return [];
    }
  } else if (Platform.OS === 'android') {
    try {
      if (!iapConnection) {
        await initializeIAP();
      }

      const products = await RNIap.fetchProducts({ skus: productIds, type: 'subs' });

      if (!products || products.length === 0) {
        logger.info('No products available from Google Play', { productIds });
        return [];
      }

      return products.map((product) => {
        const androidProduct = product as import('react-native-iap').ProductSubscriptionAndroid;
        
        // Get pricing from first subscription offer
        const firstOffer = androidProduct.subscriptionOfferDetailsAndroid?.[0];
        const pricingPhase = firstOffer?.pricingPhases?.pricingPhaseList?.[0];
        
        return {
          productId: androidProduct.id,
          price: pricingPhase?.formattedPrice || androidProduct.oneTimePurchaseOfferDetailsAndroid?.formattedPrice || '',
          currency: pricingPhase?.priceCurrencyCode || 'USD',
          title: androidProduct.title,
          description: androidProduct.description,
        };
      });
    } catch (error) {
      logger.error('Failed to get available products from Google Play', { error, productIds });
      return [];
    }
  } else {
    // Web or other platforms
    return [];
  }
}

/**
 * Purchase a subscription
 * 
 * @param productId - Product ID to purchase (e.g., com.ozmaio.bossup.basic.monthly)
 * @param tier - Subscription tier (e.g., 'basic')
 * @param billingPeriod - Billing period (e.g., 'monthly')
 * @returns Purchase result with success status
 */
export async function purchaseSubscription(
  productId: string,
  tier: string,
  billingPeriod: string
): Promise<IAPPurchaseResult> {
  if (!RNIap) {
    throw new Error('IAP not supported on this platform');
  }

  if (Platform.OS === 'ios') {
    try {
      if (!iapConnection) {
        await initializeIAP();
      }

      logger.info('Starting subscription purchase', { productId, tier, billingPeriod });

      // Request subscription
      const purchaseResult = await RNIap.requestPurchase({
        type: 'subs',
        request: {
          ios: {
            sku: productId,
          },
        },
      });

      if (!purchaseResult) {
        logger.info('Purchase cancelled - no result returned', { 
          productId,
          tier,
          billingPeriod,
          platform: Platform.OS,
          purchaseResultType: typeof purchaseResult,
          purchaseResultValue: String(purchaseResult),
        });
        trackAmplitudeEvent('iap_purchase_cancelled', {
          product_id: productId,
          platform: Platform.OS,
          tier,
          billing_period: billingPeriod,
        });
        return {
          success: false,
          error: 'Purchase cancelled',
        };
      }

      // Handle both single purchase and array (iOS returns single purchase)
      const purchase = Array.isArray(purchaseResult) ? purchaseResult[0] : purchaseResult;

      if (!purchase) {
        logger.info('Purchase cancelled - empty result', { 
          productId,
          tier,
          billingPeriod,
          platform: Platform.OS,
          purchaseResultIsArray: Array.isArray(purchaseResult),
          purchaseResultLength: Array.isArray(purchaseResult) ? purchaseResult.length : 'N/A',
          purchaseResultType: typeof purchaseResult,
          purchaseValue: String(purchase),
        });
        trackAmplitudeEvent('iap_purchase_cancelled', {
          product_id: productId,
          platform: Platform.OS,
          tier,
          billing_period: billingPeriod,
        });
        return {
          success: false,
          error: 'Purchase cancelled',
        };
      }

      logger.info('Purchase completed, verifying with backend', { 
        transactionId: purchase.transactionId,
        productId: purchase.productId,
      });

      // Get receipt (purchaseToken contains JWS for iOS, purchase token for Android)
      const receipt = purchase.purchaseToken || '';

      // Verify with backend
      const verificationResult = await verifyPurchaseWithBackend(
        receipt,
        productId,
        tier,
        billingPeriod
      );

      if (verificationResult.success) {
        // Acknowledge purchase (iOS automatically acknowledges, but good practice)
        await RNIap.finishTransaction({ purchase, isConsumable: false });

        // Track trial start if applicable
        if (verificationResult.subscription?.status === 'trial') {
          trackAmplitudeEvent('subscription_trial_started', {
            tier,
            billing_period: billingPeriod,
            platform: Platform.OS,
          });
        }

        logger.info('Purchase verified and completed', { 
          transactionId: purchase.transactionId || purchase.id,
        });

        return {
          success: true,
          transactionId: purchase.transactionId || purchase.id,
        };
      } else {
        logger.error('Purchase verification failed', { error: verificationResult.error });
        return {
          success: false,
          error: verificationResult.error || 'Verification failed',
        };
      }
    } catch (error: any) {
      // Check if user cancelled
      if (error.code === 'E_USER_CANCELLED' || (error instanceof Error && error.message.includes('cancelled'))) {
        logger.info('Purchase cancelled by user (iOS)', { 
          productId,
          tier,
          billingPeriod,
          platform: Platform.OS,
          errorCode: error.code,
          errorMessage: error.message,
        });
        trackAmplitudeEvent('iap_purchase_cancelled', {
          product_id: productId,
          platform: Platform.OS,
          tier,
          billing_period: billingPeriod,
        });
        return {
          success: false,
          error: 'Purchase cancelled',
        };
      }

      // Real error - log to Sentry with enhanced details
      const errorDetails = {
        productId,
        tier,
        billingPeriod,
        platform: Platform.OS,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: error?.code,
        errorProductId: error?.productId,
        errorResponseCode: error?.responseCode,
        errorDebugMessage: error?.debugMessage,
        errorUserInfo: error?.userInfo,
        errorStack: error instanceof Error ? error.stack : undefined,
      };

      logger.error('Purchase failed (iOS)', { 
        ...errorDetails,
        error: error instanceof Error ? error : new Error(JSON.stringify(error, null, 2)),
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Purchase failed',
      };
    }
  } else if (Platform.OS === 'android') {
    try {
      if (!iapConnection) {
        await initializeIAP();
      }

      logger.info('Starting Android subscription purchase', { productId, tier, billingPeriod });

      // First, fetch the subscription product to get offerToken
      const products = await RNIap.fetchProducts({ skus: [productId], type: 'subs' });
      
      if (!products || products.length === 0) {
        logger.error('Product not found in Google Play', { productId });
        return {
          success: false,
          error: 'Product not found',
        };
      }

      const product = products[0] as import('react-native-iap').ProductSubscriptionAndroid;
      const subscriptionOfferDetailsAndroid = product.subscriptionOfferDetailsAndroid;

      if (!subscriptionOfferDetailsAndroid || subscriptionOfferDetailsAndroid.length === 0) {
        logger.error('No subscription offers available', { productId });
        return {
          success: false,
          error: 'No subscription offers available',
        };
      }

      // Use the first available offer (base plan)
      const firstOffer = subscriptionOfferDetailsAndroid[0];
      const offerToken = firstOffer.offerToken;

      if (!offerToken) {
        logger.error('No offerToken found in subscription offer', { productId });
        return {
          success: false,
          error: 'Invalid subscription offer',
        };
      }

      // Request subscription with offerToken
      const purchaseResult = await RNIap.requestPurchase({
        type: 'subs',
        request: {
          android: {
            skus: [productId],
            subscriptionOffers: [
              {
                sku: productId,
                offerToken: offerToken,
              },
            ],
          },
        },
      });

      if (!purchaseResult) {
        logger.info('Purchase cancelled - no result returned (Android)', { 
          productId,
          tier,
          billingPeriod,
          platform: Platform.OS,
          purchaseResultType: typeof purchaseResult,
          purchaseResultValue: String(purchaseResult),
        });
        trackAmplitudeEvent('iap_purchase_cancelled', {
          product_id: productId,
          platform: Platform.OS,
          tier,
          billing_period: billingPeriod,
        });
        return {
          success: false,
          error: 'Purchase cancelled',
        };
      }

      // Handle both single purchase and array
      const purchase = Array.isArray(purchaseResult) ? purchaseResult[0] : purchaseResult;

      if (!purchase) {
        logger.info('Purchase cancelled - empty result (Android)', { 
          productId,
          tier,
          billingPeriod,
          platform: Platform.OS,
          purchaseResultIsArray: Array.isArray(purchaseResult),
          purchaseResultLength: Array.isArray(purchaseResult) ? purchaseResult.length : 'N/A',
          purchaseResultType: typeof purchaseResult,
          purchaseValue: String(purchase),
        });
        trackAmplitudeEvent('iap_purchase_cancelled', {
          product_id: productId,
          platform: Platform.OS,
          tier,
          billing_period: billingPeriod,
        });
        return {
          success: false,
          error: 'Purchase cancelled',
        };
      }

      // Check for pending purchase state (Android-specific)
      if (purchase.purchaseState === 'pending') {
        logger.info('Purchase is pending', { 
          transactionId: purchase.transactionId,
          productId: purchase.productId,
        });
        
        trackAmplitudeEvent('iap_purchase_pending', {
          product_id: productId,
          platform: Platform.OS,
          tier,
          billing_period: billingPeriod,
        });

        return {
          success: false,
          error: 'Purchase is pending verification. You will receive access once payment is confirmed.',
        };
      }

      logger.info('Purchase completed, verifying with backend', { 
        transactionId: purchase.transactionId,
        productId: purchase.productId,
      });

      // Get purchase token for backend verification
      const purchaseToken = purchase.purchaseToken || '';

      // Verify with backend
      const verificationResult = await verifyPurchaseWithBackend(
        purchaseToken,
        productId,
        tier,
        billingPeriod
      );

      if (verificationResult.success) {
        // Acknowledge purchase (required for Android)
        await RNIap.finishTransaction({ purchase, isConsumable: false });

        // Track trial start if applicable
        if (verificationResult.subscription?.status === 'trial') {
          trackAmplitudeEvent('subscription_trial_started', {
            tier,
            billing_period: billingPeriod,
            platform: Platform.OS,
          });
        }

        logger.info('Purchase verified and completed', { 
          transactionId: purchase.transactionId,
        });

        return {
          success: true,
          transactionId: purchase.transactionId || undefined,
        };
      } else {
        logger.error('Purchase verification failed', { error: verificationResult.error });
        return {
          success: false,
          error: verificationResult.error || 'Verification failed',
        };
      }
    } catch (error: any) {
      // Check if user cancelled
      if (error.code === 'E_USER_CANCELLED' || (error instanceof Error && error.message.includes('cancelled'))) {
        logger.info('Purchase cancelled by user (Android)', { 
          productId,
          tier,
          billingPeriod,
          platform: Platform.OS,
          errorCode: error.code,
          errorMessage: error.message,
        });
        trackAmplitudeEvent('iap_purchase_cancelled', {
          product_id: productId,
          platform: Platform.OS,
          tier,
          billing_period: billingPeriod,
        });
        return {
          success: false,
          error: 'Purchase cancelled',
        };
      }

      // Real error - log to Sentry with enhanced details
      const errorDetails = {
        productId,
        tier,
        billingPeriod,
        platform: Platform.OS,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: error?.code,
        errorProductId: error?.productId,
        errorResponseCode: error?.responseCode,
        errorDebugMessage: error?.debugMessage,
        errorUserInfo: error?.userInfo,
        errorStack: error instanceof Error ? error.stack : undefined,
      };

      logger.error('Purchase failed (Android)', { 
        ...errorDetails,
        error: error instanceof Error ? error : new Error(JSON.stringify(error, null, 2)),
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Purchase failed',
      };
    }
  } else {
    throw new Error('IAP not supported on this platform');
  }
}

/**
 * Verify purchase with backend Cloud Function
 */
async function verifyPurchaseWithBackend(
  receipt: string,
  productId: string,
  tier: string,
  billingPeriod: string
): Promise<{ success: boolean; error?: string; subscription?: { status: string } }> {
  try {
    const verifyIAP = httpsCallable(functions, 'verifyIAPPurchase');

    const result = await verifyIAP({
      receipt,
      productId,
      platform: Platform.OS,
      tier,
      billingPeriod,
    });

    const data = result.data as any;

    return {
      success: data.success,
      error: data.error,
      subscription: data.subscription,
    };
  } catch (error) {
    logger.error('Backend verification failed', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Check and sync subscription status
 * 
 * Automatically syncs device subscription status with Firestore
 * Called when subscription screen is focused
 * 
 * @param userId - User ID to sync
 * @returns Updated subscription status
 */
export async function checkAndSyncSubscription(userId: string): Promise<void> {
  if (!RNIap) {
    return;
  }

  if (Platform.OS === 'ios') {
    try {
      if (!iapConnection) {
        await initializeIAP();
      }

      logger.info('Checking and syncing subscription', { userId });

      // Get current purchases from device
      const availablePurchases = await RNIap.getAvailablePurchases();

      // Get current subscription from Firestore
      const db = getFirestore();
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        logger.warn('User document not found', { userId });
        return;
      }

      const userData = userSnap.data() as UserProfile;
      const currentSubscription = userData.subscription;

      // If user has Apple subscription in Firestore
      if (currentSubscription?.provider === 'apple') {
        // Check if subscription still exists on device
        const hasActiveAppleSubscription = availablePurchases.some(
          purchase => purchase.productId === currentSubscription.appleProductId
        );

        // If Firestore says active but device has no subscription
        if (
          !hasActiveAppleSubscription &&
          (currentSubscription.status === 'active' || currentSubscription.status === 'trial')
        ) {
          logger.info('Apple subscription not found on device, updating to expired', { userId });

          // Update Firestore to expired
          await updateDoc(userRef, {
            'subscription.status': 'expired',
            'subscription.updatedAt': new Date().toISOString(),
          });
        }
      }

      // If user has Stripe subscription, don't touch it
      // Stripe subscriptions are monitored separately

      logger.info('Subscription sync completed', { userId });
    } catch (error) {
      logger.error('Failed to sync subscription', { error, userId });
      // Don't throw - sync is best-effort
    }
  } else if (Platform.OS === 'android') {
    try {
      if (!iapConnection) {
        await initializeIAP();
      }

      logger.info('Checking and syncing Android subscription', { userId });

      // Get current purchases from device
      const availablePurchases = await RNIap.getAvailablePurchases();

      // Get current subscription from Firestore
      const db = getFirestore();
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        logger.warn('User document not found', { userId });
        return;
      }

      const userData = userSnap.data() as UserProfile;
      const currentSubscription = userData.subscription;

      // If user has Google subscription in Firestore
      if (currentSubscription?.provider === 'google') {
        // Check if subscription still exists on device
        const hasActiveGoogleSubscription = availablePurchases.some(
          purchase => purchase.productId === currentSubscription.googlePlayProductId
        );

        // If Firestore says active but device has no subscription
        if (
          !hasActiveGoogleSubscription &&
          (currentSubscription.status === 'active' || currentSubscription.status === 'trial')
        ) {
          logger.info('Google subscription not found on device, updating to expired', { userId });

          // Update Firestore to expired
          await updateDoc(userRef, {
            'subscription.status': 'expired',
            'subscription.updatedAt': new Date().toISOString(),
          });
        }
      }

      // If user has Stripe or Apple subscription, don't touch it
      // Those subscriptions are monitored separately

      logger.info('Subscription sync completed', { userId });
    } catch (error) {
      logger.error('Failed to sync Android subscription', { error, userId });
      // Don't throw - sync is best-effort
    }
  }
}

/**
 * Restore purchases
 * iOS: Get available purchases
 * Android: Similar flow
 * 
 * Note: Not currently exposed in UI as auto-sync handles this
 */
export async function restorePurchases(): Promise<IAPPurchaseResult> {
  if (!RNIap) {
    throw new Error('IAP not supported on this platform');
  }

  if (Platform.OS === 'ios') {
    try {
      if (!iapConnection) {
        await initializeIAP();
      }

      const purchases = await RNIap.getAvailablePurchases();

      if (purchases.length === 0) {
        return {
          success: false,
          error: 'No purchases found to restore',
        };
      }

      logger.info('Purchases restored', { count: purchases.length });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to restore purchases', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Restore failed',
      };
    }
  } else if (Platform.OS === 'android') {
    try {
      if (!iapConnection) {
        await initializeIAP();
      }

      const purchases = await RNIap.getAvailablePurchases();

      if (purchases.length === 0) {
        return {
          success: false,
          error: 'No purchases found to restore',
        };
      }

      logger.info('Purchases restored', { count: purchases.length });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to restore purchases', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Restore failed',
      };
    }
  } else {
    throw new Error('IAP not supported on this platform');
  }
}

