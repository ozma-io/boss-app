import { SubscriptionPlanConfig } from '@/types';

/**
 * Default Subscription Plans Configuration
 * 
 * ⚠️ IMPORTANT: These constants are FALLBACK values used when Firebase Remote Config is unavailable.
 * 
 * These values MUST be manually synchronized with Firebase Remote Config:
 * - Firebase Console → Remote Config → subscription_plans parameter
 * - Local template: remoteconfig.template.json
 * 
 * Any changes to pricing, trial periods, or plan details must be updated in BOTH places:
 * 1. Firebase Remote Config (via Console or remoteconfig.template.json)
 * 2. This file (DEFAULT_SUBSCRIPTION_PLANS constant)
 * 
 * The app will attempt to fetch plans from Firebase Remote Config first.
 * Only if Remote Config fails, these fallback constants will be used.
 */

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlanConfig[] = [
  {
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
  {
    tier: 'basic',
    billingPeriod: 'quarterly',
    priceAmount: 53,
    priceCurrency: 'USD',
    billingCycleMonths: 3,
    appleProductId: 'com.ozmaio.bossapp.basic.quarterly',
    googlePlayProductId: 'play_basic_quarterly',
    stripeProductId: 'price_basic_quarterly',
    enabled: true,
    trial: {
      days: 3,
    },
    savings: 4,
  },
  {
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
      days: 3,
    },
    savings: 15,
  },
  {
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
      days: 3,
    },
    savings: 48,
  },
];

/**
 * Get subscription plans for a specific tier
 */
export function getPlansForTier(tier: string): SubscriptionPlanConfig[] {
  return DEFAULT_SUBSCRIPTION_PLANS.filter(plan => plan.tier === tier && plan.enabled);
}

/**
 * Get basic tier plans (most commonly used)
 */
export function getBasicPlans(): SubscriptionPlanConfig[] {
  return getPlansForTier('basic');
}

