import { app } from '@/constants/firebase.config';
import { SubscriptionPlanConfig } from '@/types';
import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config';

const remoteConfig = getRemoteConfig(app);

// Configure Remote Config
remoteConfig.settings.minimumFetchIntervalMillis = __DEV__ 
  ? 0  // No cache in development
  : 3600000; // 1 hour cache in production

// Default subscription plans (fallback if Remote Config unavailable)
const DEFAULT_SUBSCRIPTION_PLANS: Record<string, Record<string, SubscriptionPlanConfig>> = {
  basic: {
    monthly: {
      tier: 'basic',
      billingPeriod: 'monthly',
      priceAmount: 19,
      priceCurrency: 'USD',
      billingCycleMonths: 1,
      appleProductId: 'com.ozmaio.bossapp.basic.monthly',
      googlePlayProductId: 'play_basic_monthly',
      stripeProductId: 'price_basic_monthly',
      enabled: true,
    },
    quarterly: {
      tier: 'basic',
      billingPeriod: 'quarterly',
      priceAmount: 53,
      priceCurrency: 'USD',
      billingCycleMonths: 3,
      appleProductId: 'com.ozmaio.bossapp.basic.quarterly',
      googlePlayProductId: 'play_basic_quarterly',
      stripeProductId: 'price_basic_quarterly',
      enabled: true,
      savings: 4,
    },
    semiannual: {
      tier: 'basic',
      billingPeriod: 'semiannual',
      priceAmount: 99,
      priceCurrency: 'USD',
      billingCycleMonths: 6,
      appleProductId: 'com.ozmaio.bossapp.basic.semiannual',
      googlePlayProductId: 'play_basic_semiannual',
      stripeProductId: 'price_basic_semiannual',
      enabled: true,
      trial: {
        days: 7,
      },
      savings: 15,
    },
    annual: {
      tier: 'basic',
      billingPeriod: 'annual',
      priceAmount: 180,
      priceCurrency: 'USD',
      billingCycleMonths: 12,
      appleProductId: 'com.ozmaio.bossapp.basic.annual',
      googlePlayProductId: 'play_basic_annual',
      stripeProductId: 'price_basic_annual',
      enabled: true,
      trial: {
        days: 7,
      },
      savings: 48,
    },
  },
};

/**
 * Initialize Remote Config and fetch latest values
 */
export async function initRemoteConfig(): Promise<void> {
  try {
    await fetchAndActivate(remoteConfig);
    console.log('[RemoteConfig] Successfully fetched and activated');
  } catch (error) {
    console.error('[RemoteConfig] Failed to fetch and activate:', error);
    // Continue with default values
  }
}

/**
 * Fetch subscription plans from Remote Config
 * Returns default plans if Remote Config unavailable or parsing fails
 */
export async function fetchSubscriptionPlans(): Promise<SubscriptionPlanConfig[]> {
  try {
    // Fetch and activate latest config
    await fetchAndActivate(remoteConfig);
    
    // Get subscription_plans parameter
    const plansValue = getValue(remoteConfig, 'subscription_plans');
    const plansJson = plansValue.asString();
    
    if (!plansJson) {
      console.warn('[RemoteConfig] No subscription_plans parameter found, using defaults');
      return flattenPlans(DEFAULT_SUBSCRIPTION_PLANS);
    }
    
    // Parse JSON
    const plansObject = JSON.parse(plansJson);
    
    // Validate structure
    if (!plansObject || typeof plansObject !== 'object') {
      console.error('[RemoteConfig] Invalid plans structure, using defaults');
      return flattenPlans(DEFAULT_SUBSCRIPTION_PLANS);
    }
    
    console.log('[RemoteConfig] Successfully loaded subscription plans from Remote Config');
    return flattenPlans(plansObject);
  } catch (error) {
    console.error('[RemoteConfig] Error fetching subscription plans:', error);
    console.log('[RemoteConfig] Falling back to default plans');
    return flattenPlans(DEFAULT_SUBSCRIPTION_PLANS);
  }
}

/**
 * Flatten nested plans object into array
 */
function flattenPlans(
  plansObject: Record<string, Record<string, SubscriptionPlanConfig>>
): SubscriptionPlanConfig[] {
  const plans: SubscriptionPlanConfig[] = [];
  
  for (const tier in plansObject) {
    const tierPlans = plansObject[tier];
    for (const period in tierPlans) {
      plans.push(tierPlans[period]);
    }
  }
  
  // Filter only enabled plans
  return plans.filter(plan => plan.enabled);
}

/**
 * Get subscription plans for a specific tier
 */
export async function fetchSubscriptionPlansForTier(
  tier: string
): Promise<SubscriptionPlanConfig[]> {
  const allPlans = await fetchSubscriptionPlans();
  return allPlans.filter(plan => plan.tier === tier);
}

