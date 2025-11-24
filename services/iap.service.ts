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
 * Parse product ID to extract tier and billing period
 * Apple: com.ozmaio.bossup.{tier}.{billingPeriod}
 * Google: play_{tier}:{billingPeriod}
 */
function parseProductId(productId: string): { tier: string; billingPeriod: string } | null {
  if (Platform.OS === 'ios') {
    // Apple format: com.ozmaio.bossup.basic.monthly
    const match = productId.match(/com\.ozmaio\.bossup\.([^.]+)\.([^.]+)/);
    if (match) {
      return {
        tier: match[1],
        billingPeriod: match[2],
      };
    }
  } else if (Platform.OS === 'android') {
    // Google format: play_basic:monthly
    const match = productId.match(/play_([^:]+):([^:]+)/);
    if (match) {
      return {
        tier: match[1],
        billingPeriod: match[2],
      };
    }
  }
  
  logger.warn('Could not parse product ID', { productId, platform: Platform.OS });
  return null;
}

/**
 * Select the most recent/active purchase from available purchases
 * Prioritizes purchases with most recent transaction date
 */
function selectMostRecentPurchase(purchases: any[]): any | null {
  if (!purchases || purchases.length === 0) {
    return null;
  }
  
  if (purchases.length === 1) {
    return purchases[0];
  }
  
  // Sort by transaction date (most recent first)
  const sorted = [...purchases].sort((a, b) => {
    const dateA = a.transactionDate ? new Date(a.transactionDate).getTime() : 0;
    const dateB = b.transactionDate ? new Date(b.transactionDate).getTime() : 0;
    return dateB - dateA;
  });
  
  logger.info('Selected most recent purchase', {
    totalPurchases: purchases.length,
    selectedProductId: sorted[0].productId,
    selectedTransactionDate: sorted[0].transactionDate,
  });
  
  return sorted[0];
}

/**
 * Result of subscription sync operation
 */
export interface SyncSubscriptionResult {
  success: boolean;
  foundPurchases: boolean;
  purchaseCount: number;
  restoredSubscription: boolean;
  verificationAttempted: boolean;
  verificationSuccess: boolean;
  error?: string;
  details: {
    platform: string;
    availablePurchases?: any[];
    firestoreStateBefore?: any;
    firestoreStateAfter?: any;
    verificationResult?: any;
    error?: any;
  };
}

/**
 * Check and sync subscription status
 * 
 * Automatically syncs device subscription status with Firestore
 * Called when subscription screen is focused
 * 
 * @param userId - User ID to sync
 * @returns Detailed result of sync operation
 */
export async function checkAndSyncSubscription(userId: string): Promise<SyncSubscriptionResult> {
  if (!RNIap) {
    return {
      success: false,
      foundPurchases: false,
      purchaseCount: 0,
      restoredSubscription: false,
      verificationAttempted: false,
      verificationSuccess: false,
      error: 'IAP not available on this platform',
      details: { platform: Platform.OS },
    };
  }

  if (Platform.OS === 'ios') {
    try {
      if (!iapConnection) {
        await initializeIAP();
      }

      logger.info('Checking and syncing subscription', { userId });

      // Get current purchases from device
      // onlyIncludeActiveItemsIOS: true prevents returning expired subscriptions on iOS
      const availablePurchases = await RNIap.getAvailablePurchases({
        onlyIncludeActiveItemsIOS: true,
      });

      logger.info('Found purchases on device', { 
        userId, 
        purchaseCount: availablePurchases.length,
        productIds: availablePurchases.map(p => p.productId),
      });

      // Get current subscription from Firestore
      const db = getFirestore();
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        logger.warn('User document not found', { userId });
        return {
          success: false,
          foundPurchases: availablePurchases.length > 0,
          purchaseCount: availablePurchases.length,
          restoredSubscription: false,
          verificationAttempted: false,
          verificationSuccess: false,
          error: 'User document not found',
          details: {
            platform: Platform.OS,
            availablePurchases: availablePurchases.map(p => ({
              productId: p.productId,
              transactionId: p.transactionId,
              transactionDate: p.transactionDate,
            })),
          },
        };
      }

      const userData = userSnap.data() as UserProfile;
      const currentSubscription = userData.subscription;
      
      const firestoreStateBefore = {
        hasSubscription: !!currentSubscription,
        provider: currentSubscription?.provider,
        status: currentSubscription?.status,
        tier: currentSubscription?.tier,
        billingPeriod: currentSubscription?.billingPeriod,
      };

      // Case 1: User has Apple subscription in Firestore - check if still valid
      if (currentSubscription?.provider === 'apple') {
        const hasActiveAppleSubscription = availablePurchases.some(
          purchase => purchase.productId === currentSubscription.appleProductId
        );

        // If Firestore says active but device has no subscription
        if (
          !hasActiveAppleSubscription &&
          (currentSubscription.status === 'active' || currentSubscription.status === 'trial')
        ) {
          logger.info('Apple subscription not found on device, updating to expired', { userId });

          await updateDoc(userRef, {
            'subscription.status': 'expired',
            'subscription.updatedAt': new Date().toISOString(),
          });
        }
      }
      
      // Case 2: User has NO active subscription in Firestore, but has one on device - RESTORE IT
      const hasNoActiveSubscription = !currentSubscription || 
        currentSubscription.provider === 'none' ||
        currentSubscription.status === 'expired' ||
        currentSubscription.status === 'cancelled';
      
      if (hasNoActiveSubscription && availablePurchases.length > 0) {
        logger.info('Found subscription on device but not in Firebase - restoring', { 
          userId,
          currentProvider: currentSubscription?.provider,
          currentStatus: currentSubscription?.status,
        });

        // Select the most recent purchase (in case there are multiple)
        const purchase = selectMostRecentPurchase(availablePurchases);
        
        if (!purchase) {
          logger.warn('No valid purchase found to restore', { userId });
          return {
            success: false,
            foundPurchases: true,
            purchaseCount: availablePurchases.length,
            restoredSubscription: false,
            verificationAttempted: false,
            verificationSuccess: false,
            error: 'No valid purchase found',
            details: {
              platform: Platform.OS,
              availablePurchases: availablePurchases.map(p => ({
                productId: p.productId,
                transactionId: p.transactionId,
                transactionDate: p.transactionDate,
              })),
              firestoreStateBefore,
            },
          };
        }
        
        const parsedProduct = parseProductId(purchase.productId);

        if (!parsedProduct) {
          logger.warn('Could not parse product ID for restore', { 
            productId: purchase.productId,
            userId,
          });
          return {
            success: false,
            foundPurchases: true,
            purchaseCount: availablePurchases.length,
            restoredSubscription: false,
            verificationAttempted: false,
            verificationSuccess: false,
            error: 'Could not parse product ID',
            details: {
              platform: Platform.OS,
              availablePurchases: availablePurchases.map(p => ({
                productId: p.productId,
                transactionId: p.transactionId,
                transactionDate: p.transactionDate,
              })),
              firestoreStateBefore,
            },
          };
        }

        const receipt = purchase.purchaseToken || '';
        
        if (!receipt) {
          logger.warn('No receipt found for purchase restore', { 
            productId: purchase.productId,
            userId,
          });
          return {
            success: false,
            foundPurchases: true,
            purchaseCount: availablePurchases.length,
            restoredSubscription: false,
            verificationAttempted: false,
            verificationSuccess: false,
            error: 'No receipt found',
            details: {
              platform: Platform.OS,
              availablePurchases: availablePurchases.map(p => ({
                productId: p.productId,
                transactionId: p.transactionId,
                transactionDate: p.transactionDate,
              })),
              firestoreStateBefore,
            },
          };
        }

        logger.info('Verifying restored purchase with backend', {
          userId,
          productId: purchase.productId,
          tier: parsedProduct.tier,
          billingPeriod: parsedProduct.billingPeriod,
        });

        // Verify with backend - this will write to Firebase if valid
        const verificationResult = await verifyPurchaseWithBackend(
          receipt,
          purchase.productId,
          parsedProduct.tier,
          parsedProduct.billingPeriod
        );

        if (verificationResult.success) {
          logger.info('Successfully restored subscription', { 
            userId,
            productId: purchase.productId,
          });
          
          // Finish transaction to mark it as complete
          try {
            await RNIap.finishTransaction({
              purchase,
              isConsumable: false, // Subscriptions are non-consumable
            });
            logger.info('Finished transaction for restored purchase', {
              transactionId: purchase.transactionId,
            });
          } catch (finishError) {
            logger.error('Failed to finish transaction', { 
              error: finishError,
              transactionId: purchase.transactionId,
            });
          }
          
          trackAmplitudeEvent('subscription_restored', {
            platform: Platform.OS,
            product_id: purchase.productId,
            tier: parsedProduct.tier,
            billing_period: parsedProduct.billingPeriod,
          });
          
          // Get updated state from Firestore
          const userSnapAfter = await getDoc(userRef);
          const userDataAfter = userSnapAfter.data() as UserProfile;
          
          return {
            success: true,
            foundPurchases: true,
            purchaseCount: availablePurchases.length,
            restoredSubscription: true,
            verificationAttempted: true,
            verificationSuccess: true,
            details: {
              platform: Platform.OS,
              availablePurchases: availablePurchases.map(p => ({
                productId: p.productId,
                transactionId: p.transactionId,
                transactionDate: p.transactionDate,
              })),
              firestoreStateBefore,
              firestoreStateAfter: {
                hasSubscription: !!userDataAfter.subscription,
                provider: userDataAfter.subscription?.provider,
                status: userDataAfter.subscription?.status,
                tier: userDataAfter.subscription?.tier,
                billingPeriod: userDataAfter.subscription?.billingPeriod,
              },
              verificationResult: {
                success: verificationResult.success,
                subscriptionStatus: verificationResult.subscription?.status,
              },
            },
          };
        } else {
          logger.warn('Failed to verify restored purchase', { 
            userId,
            productId: purchase.productId,
            error: verificationResult.error,
          });
          
          return {
            success: false,
            foundPurchases: true,
            purchaseCount: availablePurchases.length,
            restoredSubscription: false,
            verificationAttempted: true,
            verificationSuccess: false,
            error: verificationResult.error || 'Verification failed',
            details: {
              platform: Platform.OS,
              availablePurchases: availablePurchases.map(p => ({
                productId: p.productId,
                transactionId: p.transactionId,
                transactionDate: p.transactionDate,
              })),
              firestoreStateBefore,
              verificationResult: {
                success: verificationResult.success,
                error: verificationResult.error,
              },
            },
          };
        }
      }

      logger.info('Subscription sync completed - no restore needed', { userId });
      return {
        success: true,
        foundPurchases: availablePurchases.length > 0,
        purchaseCount: availablePurchases.length,
        restoredSubscription: false,
        verificationAttempted: false,
        verificationSuccess: false,
        details: {
          platform: Platform.OS,
          availablePurchases: availablePurchases.map(p => ({
            productId: p.productId,
            transactionId: p.transactionId,
            transactionDate: p.transactionDate,
          })),
          firestoreStateBefore,
        },
      };
    } catch (error) {
      logger.error('Failed to sync subscription', { error, userId });
      return {
        success: false,
        foundPurchases: false,
        purchaseCount: 0,
        restoredSubscription: false,
        verificationAttempted: false,
        verificationSuccess: false,
        error: error instanceof Error ? error.message : String(error),
        details: {
          platform: Platform.OS,
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
          } : String(error),
        },
      };
    }
  } else if (Platform.OS === 'android') {
    try {
      if (!iapConnection) {
        await initializeIAP();
      }

      logger.info('Checking and syncing Android subscription', { userId });

      // Get current purchases from device
      // onlyIncludeActiveItemsIOS: true prevents returning expired subscriptions (iOS only, no effect on Android)
      const availablePurchases = await RNIap.getAvailablePurchases({
        onlyIncludeActiveItemsIOS: true,
      });

      logger.info('Found purchases on device', { 
        userId, 
        purchaseCount: availablePurchases.length,
        productIds: availablePurchases.map(p => p.productId),
      });

      // Get current subscription from Firestore
      const db = getFirestore();
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        logger.warn('User document not found', { userId });
        return {
          success: false,
          foundPurchases: availablePurchases.length > 0,
          purchaseCount: availablePurchases.length,
          restoredSubscription: false,
          verificationAttempted: false,
          verificationSuccess: false,
          error: 'User document not found',
          details: {
            platform: Platform.OS,
            availablePurchases: availablePurchases.map(p => ({
              productId: p.productId,
              transactionId: p.transactionId,
              transactionDate: p.transactionDate,
            })),
          },
        };
      }

      const userData = userSnap.data() as UserProfile;
      const currentSubscription = userData.subscription;
      
      const firestoreStateBefore = {
        hasSubscription: !!currentSubscription,
        provider: currentSubscription?.provider,
        status: currentSubscription?.status,
        tier: currentSubscription?.tier,
        billingPeriod: currentSubscription?.billingPeriod,
      };

      // Case 1: User has Google subscription in Firestore - check if still valid
      if (currentSubscription?.provider === 'google') {
        const hasActiveGoogleSubscription = availablePurchases.some(
          purchase => purchase.productId === currentSubscription.googlePlayProductId
        );

        // If Firestore says active but device has no subscription
        if (
          !hasActiveGoogleSubscription &&
          (currentSubscription.status === 'active' || currentSubscription.status === 'trial')
        ) {
          logger.info('Google subscription not found on device, updating to expired', { userId });

          await updateDoc(userRef, {
            'subscription.status': 'expired',
            'subscription.updatedAt': new Date().toISOString(),
          });
        }
      }
      
      // Case 2: User has NO active subscription in Firestore, but has one on device - RESTORE IT
      const hasNoActiveSubscription = !currentSubscription || 
        currentSubscription.provider === 'none' ||
        currentSubscription.status === 'expired' ||
        currentSubscription.status === 'cancelled';
      
      if (hasNoActiveSubscription && availablePurchases.length > 0) {
        logger.info('Found subscription on device but not in Firebase - restoring', { 
          userId,
          currentProvider: currentSubscription?.provider,
          currentStatus: currentSubscription?.status,
        });

        // Select the most recent purchase (in case there are multiple)
        const purchase = selectMostRecentPurchase(availablePurchases);
        
        if (!purchase) {
          logger.warn('No valid purchase found to restore', { userId });
          return {
            success: false,
            foundPurchases: true,
            purchaseCount: availablePurchases.length,
            restoredSubscription: false,
            verificationAttempted: false,
            verificationSuccess: false,
            error: 'No valid purchase found',
            details: {
              platform: Platform.OS,
              availablePurchases: availablePurchases.map(p => ({
                productId: p.productId,
                transactionId: p.transactionId,
                transactionDate: p.transactionDate,
              })),
              firestoreStateBefore,
            },
          };
        }
        
        const parsedProduct = parseProductId(purchase.productId);

        if (!parsedProduct) {
          logger.warn('Could not parse product ID for restore', { 
            productId: purchase.productId,
            userId,
          });
          return {
            success: false,
            foundPurchases: true,
            purchaseCount: availablePurchases.length,
            restoredSubscription: false,
            verificationAttempted: false,
            verificationSuccess: false,
            error: 'Could not parse product ID',
            details: {
              platform: Platform.OS,
              availablePurchases: availablePurchases.map(p => ({
                productId: p.productId,
                transactionId: p.transactionId,
                transactionDate: p.transactionDate,
              })),
              firestoreStateBefore,
            },
          };
        }

        const receipt = purchase.purchaseToken || '';
        
        if (!receipt) {
          logger.warn('No receipt found for purchase restore', { 
            productId: purchase.productId,
            userId,
          });
          return {
            success: false,
            foundPurchases: true,
            purchaseCount: availablePurchases.length,
            restoredSubscription: false,
            verificationAttempted: false,
            verificationSuccess: false,
            error: 'No receipt found',
            details: {
              platform: Platform.OS,
              availablePurchases: availablePurchases.map(p => ({
                productId: p.productId,
                transactionId: p.transactionId,
                transactionDate: p.transactionDate,
              })),
              firestoreStateBefore,
            },
          };
        }

        logger.info('Verifying restored purchase with backend', {
          userId,
          productId: purchase.productId,
          tier: parsedProduct.tier,
          billingPeriod: parsedProduct.billingPeriod,
        });

        // Verify with backend - this will write to Firebase if valid
        const verificationResult = await verifyPurchaseWithBackend(
          receipt,
          purchase.productId,
          parsedProduct.tier,
          parsedProduct.billingPeriod
        );

        if (verificationResult.success) {
          logger.info('Successfully restored subscription', { 
            userId,
            productId: purchase.productId,
          });
          
          // Finish transaction to mark it as complete
          try {
            await RNIap.finishTransaction({
              purchase,
              isConsumable: false, // Subscriptions are non-consumable
            });
            logger.info('Finished transaction for restored purchase', {
              transactionId: purchase.transactionId,
            });
          } catch (finishError) {
            logger.error('Failed to finish transaction', { 
              error: finishError,
              transactionId: purchase.transactionId,
            });
          }
          
          trackAmplitudeEvent('subscription_restored', {
            platform: Platform.OS,
            product_id: purchase.productId,
            tier: parsedProduct.tier,
            billing_period: parsedProduct.billingPeriod,
          });
          
          // Get updated state from Firestore
          const userSnapAfter = await getDoc(userRef);
          const userDataAfter = userSnapAfter.data() as UserProfile;
          
          return {
            success: true,
            foundPurchases: true,
            purchaseCount: availablePurchases.length,
            restoredSubscription: true,
            verificationAttempted: true,
            verificationSuccess: true,
            details: {
              platform: Platform.OS,
              availablePurchases: availablePurchases.map(p => ({
                productId: p.productId,
                transactionId: p.transactionId,
                transactionDate: p.transactionDate,
              })),
              firestoreStateBefore,
              firestoreStateAfter: {
                hasSubscription: !!userDataAfter.subscription,
                provider: userDataAfter.subscription?.provider,
                status: userDataAfter.subscription?.status,
                tier: userDataAfter.subscription?.tier,
                billingPeriod: userDataAfter.subscription?.billingPeriod,
              },
              verificationResult: {
                success: verificationResult.success,
                subscriptionStatus: verificationResult.subscription?.status,
              },
            },
          };
        } else {
          logger.warn('Failed to verify restored purchase', { 
            userId,
            productId: purchase.productId,
            error: verificationResult.error,
          });
          
          return {
            success: false,
            foundPurchases: true,
            purchaseCount: availablePurchases.length,
            restoredSubscription: false,
            verificationAttempted: true,
            verificationSuccess: false,
            error: verificationResult.error || 'Verification failed',
            details: {
              platform: Platform.OS,
              availablePurchases: availablePurchases.map(p => ({
                productId: p.productId,
                transactionId: p.transactionId,
                transactionDate: p.transactionDate,
              })),
              firestoreStateBefore,
              verificationResult: {
                success: verificationResult.success,
                error: verificationResult.error,
              },
            },
          };
        }
      }

      logger.info('Subscription sync completed - no restore needed', { userId });
      return {
        success: true,
        foundPurchases: availablePurchases.length > 0,
        purchaseCount: availablePurchases.length,
        restoredSubscription: false,
        verificationAttempted: false,
        verificationSuccess: false,
        details: {
          platform: Platform.OS,
          availablePurchases: availablePurchases.map(p => ({
            productId: p.productId,
            transactionId: p.transactionId,
            transactionDate: p.transactionDate,
          })),
          firestoreStateBefore,
        },
      };
    } catch (error) {
      logger.error('Failed to sync Android subscription', { error, userId });
      return {
        success: false,
        foundPurchases: false,
        purchaseCount: 0,
        restoredSubscription: false,
        verificationAttempted: false,
        verificationSuccess: false,
        error: error instanceof Error ? error.message : String(error),
        details: {
          platform: Platform.OS,
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
          } : String(error),
        },
      };
    }
  }
  
  // Fallback for unsupported platforms
  return {
    success: false,
    foundPurchases: false,
    purchaseCount: 0,
    restoredSubscription: false,
    verificationAttempted: false,
    verificationSuccess: false,
    error: 'Unsupported platform',
    details: { platform: Platform.OS },
  };
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

