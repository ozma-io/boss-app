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
import * as RNIap from 'react-native-iap';
import { logger } from './logger.service';

let iapConnection: boolean = false;

/**
 * Initialize IAP connection
 * Should be called on app startup
 */
export async function initializeIAP(): Promise<void> {
  if (iapConnection) {
    return;
  }

  try {
    // Only initialize for iOS (Android coming soon)
    if (Platform.OS === 'ios') {
      await RNIap.initConnection();
      iapConnection = true;
      logger.info('IAP connection initialized', { platform: Platform.OS });

      // Setup purchase update listener
      setupPurchaseListener();
    } else {
      logger.info('IAP not initialized - Android support coming soon', { platform: Platform.OS });
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
  if (!iapConnection) {
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
  if (Platform.OS !== 'ios') {
    return;
  }

  const purchaseUpdateSubscription = RNIap.purchaseUpdatedListener((purchase) => {
    logger.info('Purchase update received', { 
      productId: purchase.productId,
      transactionId: purchase.transactionId,
    });
  });

  const purchaseErrorSubscription = RNIap.purchaseErrorListener((error) => {
    logger.error('Purchase error', { error });
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
  if (Platform.OS === 'ios') {
    try {
      if (!iapConnection) {
        await initializeIAP();
      }

      const products = await RNIap.fetchProducts({ skus: productIds, type: 'subs' });

      if (!products) {
        return [];
      }

      return products.map((product) => {
        const iosProduct = product as RNIap.ProductSubscriptionIOS;
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
    // TODO: Implement Android support
    logger.info('Android IAP not yet implemented', { productIds });
    return [];
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
        throw new Error('Purchase failed - no purchase object returned');
      }

      // Handle both single purchase and array (iOS returns single purchase)
      const purchase = Array.isArray(purchaseResult) ? purchaseResult[0] : purchaseResult;

      if (!purchase) {
        throw new Error('Purchase failed - empty purchase result');
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
    } catch (error) {
      logger.error('Purchase failed', { error, productId });
      
      // Check if user cancelled
      if (error instanceof Error && error.message.includes('cancelled')) {
        return {
          success: false,
          error: 'Purchase cancelled',
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Purchase failed',
      };
    }
  } else if (Platform.OS === 'android') {
    // TODO: Implement Android support
    throw new Error('Android IAP not yet implemented. Coming soon!');
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
): Promise<{ success: boolean; error?: string }> {
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
    // TODO: Implement Android sync
    logger.info('Android subscription sync not yet implemented', { userId });
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
    // TODO: Implement Android restore
    throw new Error('Android IAP not yet implemented. Coming soon!');
  } else {
    throw new Error('IAP not supported on this platform');
  }
}

