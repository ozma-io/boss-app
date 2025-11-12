import { useUserProfile } from '@/hooks/useUserProfile';
import { fetchSubscriptionPlans } from '@/services/remoteConfig.service';
import {
  formatBillingPeriodLabel,
  formatNextPaymentDate,
  formatPrice,
  getBillingPeriodDescription,
  getSubscriptionDisplayInfo,
} from '@/services/subscription.service';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { logger } from '@/services/logger.service';
import { SubscriptionPlanConfig } from '@/types';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const { profile, loading: profileLoading } = useUserProfile();
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const subscriptionInfo = getSubscriptionDisplayInfo(profile);

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('subscription_screen_viewed', {
        hasSubscription: subscriptionInfo.hasSubscription,
        tier: subscriptionInfo.tier,
        billingPeriod: subscriptionInfo.billingPeriod,
      });
    }, [subscriptionInfo.hasSubscription, subscriptionInfo.tier, subscriptionInfo.billingPeriod])
  );

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setPlansLoading(true);
      setPlansError(null);
      const fetchedPlans = await fetchSubscriptionPlans();
      // Only show Basic tier plans for now
      const basicPlans = fetchedPlans.filter(plan => plan.tier === 'basic');
      setPlans(basicPlans);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to load subscription plans', error instanceof Error ? error : new Error(errorMessage), { feature: 'SubscriptionScreen' });
      
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

  const handleSubscribeOrChange = (): void => {
    if (!selectedPlan) return;

    // TODO: Implement Apple/Google IAP integration
    Alert.alert(
      subscriptionInfo.hasSubscription ? 'Change Plan' : 'Subscribe',
      'Apple/Google IAP integration coming soon.\n\nSelected plan: ' + selectedPlan,
      [{ text: 'OK' }]
    );

    trackAmplitudeEvent('subscription_button_clicked', {
      action: subscriptionInfo.hasSubscription ? 'change_plan' : 'subscribe',
      selectedPlan: selectedPlan,
      currentPlan: subscriptionInfo.billingPeriod,
    });
  };

  const handleCancelSubscription = (): void => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement cancellation logic
            logger.info('Subscription cancellation requested', { feature: 'SubscriptionScreen' });
            trackAmplitudeEvent('subscription_cancel_clicked');
          },
        },
      ]
    );
  };

  const renderPlanCard = (plan: SubscriptionPlanConfig) => {
    const isCurrentPlan = subscriptionInfo.hasSubscription && 
      profile?.subscription?.billingPeriod === plan.billingPeriod;
    const isSelected = selectedPlan === plan.billingPeriod;
    const planKey = `${plan.tier}_${plan.billingPeriod}`;

    return (
      <Pressable
        key={planKey}
        style={({ pressed }) => [
          styles.planCard,
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
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.plansContainer}
              testID="plans-container"
            >
              {plans.map((plan) => renderPlanCard(plan))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]} testID="subscription-footer">
        <Pressable
          style={({ pressed }) => [
            styles.changePlanButton,
            !selectedPlan && styles.changePlanButtonDisabled,
            pressed && selectedPlan && styles.buttonPressed
          ]}
          onPress={selectedPlan ? handleSubscribeOrChange : undefined}
          disabled={!selectedPlan}
          testID="subscribe-change-button"
        >
          <Text style={styles.changePlanButtonText} testID="subscribe-change-button-text">
            {subscriptionInfo.buttonText}
          </Text>
          <FontAwesome name="arrow-right" size={16} color="#fff" testID="subscribe-change-arrow-icon" />
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
    paddingBottom: 24,
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
  planCard: {
    width: 170,
    minHeight: 160,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    position: 'relative',
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
    backgroundColor: '#F5F1E8',
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
    opacity: 0.7,
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
});
