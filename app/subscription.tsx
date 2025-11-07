import { AppColors } from '@/constants/Colors';
import { SubscriptionPlan } from '@/types';
import { mockSubscriptionPlans, mockUserSubscription } from '@/utils/mockData';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function SubscriptionScreen() {
  const currentPlan = mockSubscriptionPlans.find(
    (p) => p.type === mockUserSubscription.currentPlan
  );

  const handleChangePlan = (): void => {
    Alert.alert('Change Plan', 'This feature is not yet implemented.');
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
            console.log('Subscription cancellation requested');
          },
        },
      ]
    );
  };

  const renderPlanCard = (plan: SubscriptionPlan, isActive: boolean) => {
    const getPlanTitle = (type: string): string => {
      switch (type) {
        case 'monthly':
          return 'Monthly';
        case 'semi-annual':
          return 'Semi-Annual';
        case 'quarterly':
          return 'Quarterly';
        default:
          return type;
      }
    };

    return (
      <View
        key={plan.type}
        style={[
          styles.planCard,
          isActive && styles.activePlanCard,
        ]}
      >
        <View style={styles.planHeader}>
          <Text style={styles.planTitle}>{getPlanTitle(plan.type)}</Text>
          {isActive && (
            <View style={styles.activeBadge}>
              <FontAwesome name="check" size={12} color="#fff" />
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          )}
        </View>
        <View style={styles.planPricing}>
          <Text style={styles.planPrice}>${plan.price}</Text>
          <Text style={styles.planPeriod}> / {plan.billingPeriod}</Text>
        </View>
        {plan.hasTrial && (
          <View style={styles.trialBadge}>
            <FontAwesome name="gift" size={14} color="#333" />
            <Text style={styles.trialText}>Free {plan.trialDays} days trail</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.currentPlanCard, styles.activePlanCard]}>
          <View style={styles.currentPlanHeader}>
            <Text style={styles.yourPlanLabel}>Your plan</Text>
            <View style={styles.activeBadge}>
              <FontAwesome name="check" size={12} color="#fff" />
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          </View>
          <Text style={styles.currentPlanTitle}>
            {currentPlan ? currentPlan.type.charAt(0).toUpperCase() + currentPlan.type.slice(1) : 'Quarterly'}
          </Text>
          <Text style={styles.currentPlanDescription}>
            You pay {mockUserSubscription.price}$ every 3 month. You save {mockUserSubscription.savings}$
          </Text>
          <Text style={styles.nextPayment}>
            Next payment: {mockUserSubscription.nextPaymentDate}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>You can change your plan</Text>

        <View style={styles.plansContainer}>
          {mockSubscriptionPlans
            .filter((plan) => plan.type !== mockUserSubscription.currentPlan)
            .map((plan) => renderPlanCard(plan, false))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.changePlanButton,
            pressed && styles.buttonPressed
          ]}
          onPress={handleChangePlan}
        >
          <Text style={styles.changePlanButtonText}>Change plan</Text>
          <FontAwesome name="arrow-right" size={16} color="#fff" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.buttonPressed
          ]}
          onPress={handleCancelSubscription}
        >
          <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    padding: 16,
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
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  currentPlanTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  currentPlanDescription: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    lineHeight: 22,
  },
  nextPayment: {
    fontSize: 14,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  plansContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
  },
  planPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  planPeriod: {
    fontSize: 14,
    color: '#666',
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  trialText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 4,
  },
  changePlanButton: {
    backgroundColor: '#333',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  changePlanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});

