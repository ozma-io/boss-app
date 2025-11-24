import { functions } from '@/constants/firebase.config';
import { useUserProfile } from '@/hooks/useUserProfile';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { checkAndSyncSubscription, endIAPConnection, initializeIAP, purchaseSubscription } from '@/services/iap.service';
import { logger } from '@/services/logger.service';
import { fetchSubscriptionPlans } from '@/services/remoteConfig.service';
import {
  formatBillingPeriodLabel,
  formatNextPaymentDate,
  formatPrice,
  getBillingPeriodDescription,
  getSubscriptionDisplayInfo,
} from '@/services/subscription.service';
import { CancelSubscriptionResponse, SubscriptionPlanConfig } from '@/types';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from 'expo-router';
import { httpsCallable } from 'firebase/functions';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const { profile, loading: profileLoading } = useUserProfile();
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const subscriptionInfo = getSubscriptionDisplayInfo(profile);

  // Track screen views
  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('subscription_screen_viewed', {
        hasSubscription: subscriptionInfo.hasSubscription,
        tier: subscriptionInfo.tier,
        billingPeriod: subscriptionInfo.billingPeriod,
      });
    }, [subscriptionInfo.hasSubscription, subscriptionInfo.tier, subscriptionInfo.billingPeriod])
  );

  // Auto-sync subscription on screen focus
  useFocusEffect(
    useCallback(() => {
      if (profile?.id && (Platform.OS === 'ios' || Platform.OS === 'android')) {
        syncSubscription();
      }
    }, [profile?.id])
  );

  // Initialize IAP
  useEffect(() => {
    loadPlans();
    
    // Initialize IAP connection
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      initializeIAP().catch((error) => {
        logger.error('Failed to initialize IAP', { feature: 'SubscriptionScreen', error });
      });
    }

    // Cleanup
    return () => {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        endIAPConnection().catch((error) => {
          logger.error('Failed to end IAP connection', { feature: 'SubscriptionScreen', error });
        });
      }
    };
  }, []);

  async function loadPlans() {
    try {
      setPlansLoading(true);
      setPlansError(null);
      const fetchedPlans = await fetchSubscriptionPlans();
      // Only show Basic tier plans for now
      const basicPlans = fetchedPlans.filter(plan => plan.tier === 'basic');
      setPlans(basicPlans);
      
      // Note: fetchSubscriptionPlans() now includes fallback to DEFAULT_SUBSCRIPTION_PLANS
      // so it will always return plans (either from Firebase or from constants)
    } catch (error) {
      // This catch block should rarely execute now since fetchSubscriptionPlans() 
      // falls back to constants instead of throwing
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to load subscription plans', { feature: 'SubscriptionScreen', error: error instanceof Error ? error : new Error(errorMessage) });
      
      // Track error in Amplitude
      trackAmplitudeEvent('subscription_plans_load_failed', {
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'unknown',
      });
      
      setPlansError('Failed to load subscription plans. We are working on fixing this issue.');
    } finally {
      setPlansLoading(false);
    }
  }

  async function syncSubscription() {
    if (!profile?.id) return;

    try {
      setSyncing(true);
      const syncResult = await checkAndSyncSubscription(profile.id);
      
      // Log if sync found purchases but couldn't restore them - THIS IS AN ERROR!
      if (syncResult.foundPurchases && !syncResult.restoredSubscription && syncResult.verificationAttempted) {
        const syncError = new Error('Auto-sync found purchases but failed to restore');
        logger.error('Auto-sync found purchases but failed to restore', {
          feature: 'SubscriptionScreen',
          error: syncError,
          userId: profile.id,
          userEmail: profile.email,
          syncResult: {
            success: syncResult.success,
            foundPurchases: syncResult.foundPurchases,
            purchaseCount: syncResult.purchaseCount,
            verificationSuccess: syncResult.verificationSuccess,
            error: syncResult.error,
          },
          details: syncResult.details,
        });
      }
      
      // Profile will update automatically via real-time Firestore listener
    } catch (error) {
      logger.error('Failed to sync subscription', { feature: 'SubscriptionScreen', error });
    } finally {
      setSyncing(false);
    }
  }

  const executeSubscriptionCancellation = async (): Promise<void> => {
    if (cancelling) return;

    try {
      setCancelling(true);

      logger.info('Executing subscription cancellation', { 
        feature: 'SubscriptionScreen',
        provider: profile?.subscription?.provider 
      });

      // Call Cloud Function to cancel subscription
      const cancelSubscriptionFn = httpsCallable<{}, CancelSubscriptionResponse>(
        functions, 
        'cancelSubscription'
      );

      const result = await cancelSubscriptionFn({});
      const data = result.data;

      if (data.success) {
        // Track success
        trackAmplitudeEvent('subscription_cancel_success', {
          provider: profile?.subscription?.provider,
          currentPeriodEnd: data.currentPeriodEnd,
        });

        // Format end date for display
        const endDate = data.currentPeriodEnd 
          ? formatNextPaymentDate(data.currentPeriodEnd)
          : 'the end of your billing period';

        // Show success message
        Alert.alert(
          'Subscription Cancelled',
          `Your subscription has been cancelled. You will continue to have access until ${endDate}.`,
          [{ text: 'OK' }]
        );

        // Profile will update automatically via real-time Firestore listener
      } else {
        // Track failure
        trackAmplitudeEvent('subscription_cancel_failed', {
          provider: profile?.subscription?.provider,
          error: data.error,
        });

        // Show error message
        Alert.alert(
          'Cancellation Failed',
          data.error || 'Unable to cancel subscription. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      logger.error('Subscription cancellation error', { 
        feature: 'SubscriptionScreen', 
        error 
      });

      trackAmplitudeEvent('subscription_cancel_error', {
        provider: profile?.subscription?.provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleSubscribeOrChange = async (): Promise<void> => {
    if (!selectedPlan || purchasing) return;

    const action = subscriptionInfo.hasSubscription ? 'change_plan' : 'subscribe';

    // Track button click
    trackAmplitudeEvent('subscription_button_clicked', {
      action,
      selectedPlan: selectedPlan,
      currentPlan: subscriptionInfo.billingPeriod,
    });

    // Check platform - only iOS and Android are supported
    if (Platform.OS === 'web') {
      Alert.alert(
        'Not Available on Web',
        'Sorry, this action is not possible on the web platform. Please use your iOS or Android app.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      Alert.alert(
        'Not Available',
        'Subscriptions are only available on iOS and Android devices.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Find selected plan
    const plan = plans.find(p => p.billingPeriod === selectedPlan);
    if (!plan) {
      Alert.alert('Error', 'Selected plan not found');
      return;
    }

    try {
      setPurchasing(true);

      logger.info('Starting subscription purchase', {
        feature: 'SubscriptionScreen',
        productId: plan.appleProductId,
        tier: plan.tier,
        billingPeriod: plan.billingPeriod,
      });

      // Purchase subscription
      const result = await purchaseSubscription(
        plan.appleProductId,
        plan.tier,
        plan.billingPeriod
      );

      if (result.success) {
        // Track success
        trackAmplitudeEvent('subscription_purchase_success', {
          action,
          tier: plan.tier,
          billingPeriod: plan.billingPeriod,
          transactionId: result.transactionId,
        });

        // Profile will update automatically via real-time Firestore listener

        // Show success message
        Alert.alert(
          'Success!',
          action === 'change_plan' 
            ? 'Your subscription plan has been changed successfully.' 
            : 'Welcome to BossUp Premium! Your subscription is now active.',
          [{ text: 'OK' }]
        );

        // Clear selection
        setSelectedPlan(null);
      } else {
        // Track failure
        trackAmplitudeEvent('subscription_purchase_failed', {
          action,
          tier: plan.tier,
          billingPeriod: plan.billingPeriod,
          error: result.error,
        });

        // Show error (unless user cancelled)
        if (result.error !== 'Purchase cancelled') {
          Alert.alert(
            'Purchase Failed',
            result.error || 'Unable to complete purchase. Please try again.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      // Enhanced error logging with detailed context
      const errorDetails = {
        feature: 'SubscriptionScreen',
        action,
        productId: plan.appleProductId,
        tier: plan.tier,
        billingPeriod: plan.billingPeriod,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: (error as any)?.code,
        errorProductId: (error as any)?.productId,
        errorResponseCode: (error as any)?.responseCode,
        errorDebugMessage: (error as any)?.debugMessage,
        platform: Platform.OS,
      };

      logger.error('Purchase error', { 
        ...errorDetails,
        error: error instanceof Error ? error : new Error(JSON.stringify(error, null, 2)),
      });
      
      trackAmplitudeEvent('subscription_purchase_error', {
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: (error as any)?.code,
      });

      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestorePurchases = async (): Promise<void> => {
    if (!profile?.id || restoring) return;

    try {
      setRestoring(true);

      trackAmplitudeEvent('subscription_restore_clicked', {
        platform: Platform.OS,
      });

      // Perform sync and get detailed result
      const syncResult = await checkAndSyncSubscription(profile.id);

      logger.info('Restore purchases completed', {
        feature: 'SubscriptionScreen',
        syncResult: {
          success: syncResult.success,
          foundPurchases: syncResult.foundPurchases,
          purchaseCount: syncResult.purchaseCount,
          restoredSubscription: syncResult.restoredSubscription,
          verificationAttempted: syncResult.verificationAttempted,
          verificationSuccess: syncResult.verificationSuccess,
        },
      });

      // Check if subscription was restored successfully
      if (syncResult.restoredSubscription) {
        trackAmplitudeEvent('subscription_restore_success', {
          platform: Platform.OS,
          provider: syncResult.details.firestoreStateAfter?.provider,
        });

        Alert.alert(
          'Success!',
          'Your subscription has been restored.',
          [{ text: 'OK' }]
        );
      } else if (syncResult.foundPurchases && !syncResult.restoredSubscription) {
        // CRITICAL: Purchases found but NOT restored - log to Sentry
        const sentryError = new Error('Restore Purchases Failed: Purchases found but not restored');
        logger.error('Restore purchases failed with purchases found', {
          feature: 'SubscriptionScreen',
          error: sentryError,
          userId: profile.id,
          userEmail: profile.email,
          syncResult: {
            success: syncResult.success,
            foundPurchases: syncResult.foundPurchases,
            purchaseCount: syncResult.purchaseCount,
            restoredSubscription: syncResult.restoredSubscription,
            verificationAttempted: syncResult.verificationAttempted,
            verificationSuccess: syncResult.verificationSuccess,
            error: syncResult.error,
          },
          details: syncResult.details,
        });

        trackAmplitudeEvent('subscription_restore_failed_with_purchases', {
          platform: Platform.OS,
          purchaseCount: syncResult.purchaseCount,
          verificationAttempted: syncResult.verificationAttempted,
          verificationSuccess: syncResult.verificationSuccess,
          error: syncResult.error,
        });

        Alert.alert(
          'Restore Failed',
          'We found your purchase but couldn\'t restore it. Our team has been notified. Please try again or contact support.',
          [{ text: 'OK' }]
        );
      } else {
        // No purchases found
        trackAmplitudeEvent('subscription_restore_no_purchases', {
          platform: Platform.OS,
        });

        Alert.alert(
          'No Subscription Found',
          'We couldn\'t find any active subscription to restore. If you believe this is an error, please contact support.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      logger.error('Failed to restore purchases', { 
        feature: 'SubscriptionScreen',
        error,
        userId: profile.id,
        userEmail: profile.email,
      });

      trackAmplitudeEvent('subscription_restore_error', {
        platform: Platform.OS,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      Alert.alert(
        'Error',
        'Failed to restore purchases. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setRestoring(false);
    }
  };

  const handleCancelSubscription = (): void => {
    const provider = profile?.subscription?.provider;

    trackAmplitudeEvent('subscription_cancel_clicked', {
      provider,
    });

    // Apple and Google must be cancelled through native Settings
    if (provider === 'apple') {
      Alert.alert(
        'Cancel Subscription',
        'To cancel your Apple subscription, please go to:\n\nSettings → [Your Name] → Subscriptions → BossUp\n\nYou can cancel your subscription there.',
        [
          { text: 'OK' },
        ]
      );
    } else if (provider === 'google') {
      // TODO: Implement Google Play cancellation flow
      Alert.alert(
        'Cancel Subscription',
        'To cancel your Google Play subscription, please visit the Google Play Store app and manage your subscriptions there.',
        [
          { text: 'OK' },
        ]
      );
    } else if (provider && provider !== 'none') {
      // For all other providers (handled on server side)
      trackAmplitudeEvent('subscription_cancel_confirmed', {
        provider,
      });

      Alert.alert(
        'Cancel Subscription?',
        'Your subscription will remain active until the end of the current billing period. You can resubscribe at any time.',
        [
          { 
            text: 'Keep Subscription', 
            style: 'cancel',
            onPress: () => {
              trackAmplitudeEvent('subscription_cancel_dismissed', {
                provider,
              });
            }
          },
          { 
            text: 'Cancel Subscription', 
            style: 'destructive',
            onPress: executeSubscriptionCancellation
          },
        ]
      );
    } else {
      Alert.alert(
        'No Active Subscription',
        'You don\'t have an active subscription to cancel.',
        [{ text: 'OK' }]
      );
    }
  };

  const renderPlanCard = (plan: SubscriptionPlanConfig) => {
    const isCurrentPlan = subscriptionInfo.hasSubscription && 
      profile?.subscription?.billingPeriod === plan.billingPeriod;
    const isSelected = selectedPlan === plan.billingPeriod;
    const planKey = `${plan.tier}_${plan.billingPeriod}`;
    const isGridLayout = !subscriptionInfo.hasSubscription;

    return (
      <Pressable
        key={planKey}
        style={({ pressed }) => [
          styles.planCard,
          isGridLayout && styles.planCardGrid,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => {
          if (!isCurrentPlan) {
            setSelectedPlan(isSelected ? null : plan.billingPeriod);
          }
        }}
        disabled={isCurrentPlan}
        testID={`plan-card-${plan.billingPeriod}`}
      >
        <View 
          style={[
            styles.checkmarkContainer,
            !isSelected && styles.checkmarkContainerUnselected
          ]} 
          testID={`plan-checkmark-${plan.billingPeriod}`}
        >
          {isSelected && (
            <FontAwesome name="check" size={12} color="#fff" testID={`plan-checkmark-icon-${plan.billingPeriod}`} />
          )}
        </View>
        <View style={styles.planHeader} testID={`plan-header-${plan.billingPeriod}`}>
          <Text style={styles.planTitle} testID={`plan-title-${plan.billingPeriod}`}>
            {formatBillingPeriodLabel(plan.billingPeriod)}
          </Text>
        </View>
        <View style={styles.planPricing} testID={`plan-pricing-${plan.billingPeriod}`}>
          <Text style={styles.planPrice} testID={`plan-price-${plan.billingPeriod}`}>
            {formatPrice(plan.priceAmount, plan.priceCurrency)}
          </Text>
          <Text style={styles.planPeriod} testID={`plan-period-${plan.billingPeriod}`}>
            {' / '}{getBillingPeriodDescription(plan.billingPeriod, plan.billingCycleMonths)}
          </Text>
        </View>
        {plan.trial && (
          <View style={styles.trialBadge} testID={`plan-trial-badge-${plan.billingPeriod}`}>
            <FontAwesome name="gift" size={14} color="#333" testID={`plan-trial-icon-${plan.billingPeriod}`} />
            <Text style={styles.trialText} testID={`plan-trial-text-${plan.billingPeriod}`}>
              Free {plan.trial.days} days trial
            </Text>
          </View>
        )}
        {plan.savings && plan.savings > 0 && (
          <View style={styles.savingsBadge} testID={`plan-savings-badge-${plan.billingPeriod}`}>
            <Text style={styles.savingsText} testID={`plan-savings-text-${plan.billingPeriod}`}>
              Save ${plan.savings}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  if (profileLoading || plansLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#333" />
        <Text style={styles.loadingText}>Loading subscription...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="subscription-container">
      <ScrollView style={styles.scrollView} testID="subscription-scroll">
        <View style={styles.content} testID="subscription-content">
          {/* Show current plan card only if user has active subscription */}
          {subscriptionInfo.hasSubscription && profile?.subscription && (
            <View style={[styles.currentPlanCard, styles.activePlanCard]} testID="current-plan-card">
              <View style={styles.currentPlanHeader} testID="current-plan-header">
                <Text style={styles.yourPlanLabel} testID="your-plan-label">Your plan</Text>
                <View style={styles.activeBadge} testID="current-plan-active-badge">
                  <FontAwesome name="check" size={12} color="#333" testID="current-plan-active-icon" />
                  <Text style={styles.activeBadgeText} testID="current-plan-active-text">Active</Text>
                </View>
              </View>
              <Text style={styles.currentPlanTitle} testID="current-plan-title">
                {formatBillingPeriodLabel(profile.subscription.billingPeriod || 'monthly')}
              </Text>
              <Text style={styles.currentPlanDescription} testID="current-plan-description">
                You pay {formatPrice(profile.subscription.priceAmount || 0, profile.subscription.priceCurrency)} {getBillingPeriodDescription(profile.subscription.billingPeriod || 'monthly', profile.subscription.billingCycleMonths || 1)}.
              </Text>
              {profile.subscription.currentPeriodEnd && (
                <Text style={styles.nextPayment} testID="next-payment-text">
                  Next payment: {formatNextPaymentDate(profile.subscription.currentPeriodEnd)}
                </Text>
              )}
            </View>
          )}

          <Text style={styles.sectionTitle} testID="section-title">
            {subscriptionInfo.hasSubscription ? 'You can change your plan' : 'Choose your plan'}
          </Text>

          {plansError ? (
            <View style={styles.errorContainer} testID="plans-error-container">
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{plansError}</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={loadPlans}
                testID="retry-button"
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          ) : plans.length === 0 ? (
            <Text style={styles.noPlansText}>No subscription plans available at the moment.</Text>
          ) : subscriptionInfo.hasSubscription ? (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.plansContainer}
              testID="plans-container"
            >
              {plans.map((plan) => renderPlanCard(plan))}
            </ScrollView>
          ) : (
            <>
              <View style={styles.plansGridContainer} testID="plans-grid-container">
                {plans.map((plan) => renderPlanCard(plan))}
              </View>
              
              {/* Value proposition for new subscribers */}
              <View style={styles.valuePropositionContainer} testID="value-proposition">
                <Text style={styles.valuePropositionTitle} testID="value-proposition-title">
                  What's included
                </Text>
                <View style={styles.valuePropositionList}>
                  <View style={styles.valuePropositionItem}>
                    <Text style={styles.valuePropositionIcon}>💬</Text>
                    <Text style={styles.valuePropositionText}>
                      Unlimited AI conversations about your workplace situations
                    </Text>
                  </View>
                  <View style={styles.valuePropositionItem}>
                    <Text style={styles.valuePropositionIcon}>🎯</Text>
                    <Text style={styles.valuePropositionText}>
                      Personalized advice based on your manager's style and goals
                    </Text>
                  </View>
                  <View style={styles.valuePropositionItem}>
                    <Text style={styles.valuePropositionIcon}>🔔</Text>
                    <Text style={styles.valuePropositionText}>
                      Proactive reminders to document wins and follow up
                    </Text>
                  </View>
                  <View style={styles.valuePropositionItem}>
                    <Text style={styles.valuePropositionIcon}>📈</Text>
                    <Text style={styles.valuePropositionText}>
                      Track your growth with timeline and smart recommendations
                    </Text>
                  </View>
                </View>
              </View>

              {/* Restore Purchases Link */}
              <View style={styles.restorePurchasesContainer} testID="restore-purchases-container">
                <Text style={styles.restorePurchasesText}>Already have a subscription?</Text>
                <Pressable
                  onPress={handleRestorePurchases}
                  disabled={restoring}
                  style={({ pressed }) => [
                    styles.restorePurchasesButton,
                    pressed && styles.buttonPressed
                  ]}
                  testID="restore-purchases-button"
                >
                  {restoring ? (
                    <ActivityIndicator size="small" color="#666" testID="restore-purchases-loading" />
                  ) : (
                    <Text style={styles.restorePurchasesButtonText} testID="restore-purchases-button-text">
                      Restore Purchases
                    </Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]} testID="subscription-footer">
        <Pressable
          style={({ pressed }) => [
            styles.changePlanButton,
            (!selectedPlan || purchasing) && styles.changePlanButtonDisabled,
            pressed && selectedPlan && !purchasing && styles.buttonPressed
          ]}
          onPress={selectedPlan && !purchasing ? handleSubscribeOrChange : undefined}
          disabled={!selectedPlan || purchasing}
          testID="subscribe-change-button"
        >
          {purchasing ? (
            <>
              <ActivityIndicator size="small" color="#fff" testID="subscribe-change-loading" />
              <Text style={[styles.changePlanButtonText, { marginLeft: 8 }]} testID="subscribe-change-button-text">
                Processing...
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.changePlanButtonText} testID="subscribe-change-button-text">
                {subscriptionInfo.buttonText}
              </Text>
              <FontAwesome name="arrow-right" size={16} color="#fff" testID="subscribe-change-arrow-icon" />
            </>
          )}
        </Pressable>

        {subscriptionInfo.hasSubscription && (
          <Pressable
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.buttonPressed
            ]}
            onPress={handleCancelSubscription}
            testID="cancel-subscription-button"
          >
            <Text style={styles.cancelButtonText} testID="cancel-subscription-button-text">
              Cancel Subscription
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F1E8',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    fontFamily: 'Manrope-Regular',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  currentPlanCard: {
    backgroundColor: '#B8E986',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  activePlanCard: {
    backgroundColor: '#B8E986',
  },
  currentPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  yourPlanLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    fontFamily: 'Manrope-Regular',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    fontFamily: 'Manrope-SemiBold',
  },
  currentPlanTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    fontFamily: 'Manrope-Bold',
  },
  currentPlanDescription: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    lineHeight: 22,
    fontFamily: 'Manrope-Regular',
  },
  nextPayment: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Manrope-Regular',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  noPlansText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    fontFamily: 'Manrope-Regular',
  },
  errorContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginTop: 8,
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
    fontFamily: 'Manrope-Regular',
  },
  retryButton: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Manrope-SemiBold',
  },
  plansContainer: {
    paddingRight: 16,
    gap: 12,
  },
  plansGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  planCard: {
    width: 170,
    minHeight: 160,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    position: 'relative',
  },
  planCardGrid: {
    flexBasis: '48%',
    width: undefined,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Manrope-SemiBold',
  },
  planPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  planPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'Manrope-Bold',
  },
  planPeriod: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Manrope-Regular',
    flexShrink: 1,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  trialText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 4,
    fontFamily: 'Manrope-Regular',
  },
  savingsBadge: {
    backgroundColor: '#B8E986',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  savingsText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
    fontFamily: 'Manrope-SemiBold',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  changePlanButton: {
    backgroundColor: '#333',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  changePlanButtonDisabled: {
    backgroundColor: '#B3B3B3',
  },
  changePlanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
    fontFamily: 'Manrope-SemiBold',
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ff3b30',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Manrope-SemiBold',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  checkmarkContainerUnselected: {
    backgroundColor: '#F5F1E8',
  },
  valuePropositionContainer: {
    marginTop: 32,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  valuePropositionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  valuePropositionList: {
    gap: 16,
  },
  valuePropositionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  valuePropositionIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  valuePropositionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
    fontFamily: 'Manrope-Regular',
  },
  restorePurchasesContainer: {
    marginTop: 24,
    alignItems: 'center',
    paddingBottom: 8,
  },
  restorePurchasesText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontFamily: 'Manrope-Regular',
  },
  restorePurchasesButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  restorePurchasesButtonText: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'underline',
    fontFamily: 'Manrope-Regular',
  },
});
