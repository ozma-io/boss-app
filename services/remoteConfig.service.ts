import { app } from '@/constants/firebase.config';
import { DEFAULT_SUBSCRIPTION_PLANS } from '@/constants/subscriptionPlans';
import { SubscriptionPlanConfig } from '@/types';
import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config';
import { logger } from './logger.service';

const remoteConfig = getRemoteConfig(app);

// Configure Remote Config
remoteConfig.settings.minimumFetchIntervalMillis = __DEV__ 
  ? 0  // No cache in development
  : 3600000; // 1 hour cache in production

/**
 * Initialize Remote Config and fetch latest values
 */
export async function initRemoteConfig(): Promise<void> {
  try {
    await fetchAndActivate(remoteConfig);
    logger.info('Successfully fetched and activated', { feature: 'RemoteConfig' });
  } catch (error) {
    logger.error('Failed to fetch and activate', { feature: 'RemoteConfig', error });
    throw error;
  }
}

/**
 * Fetch subscription plans from Remote Config
 * Falls back to DEFAULT_SUBSCRIPTION_PLANS if Remote Config unavailable or parsing fails
 */
export async function fetchSubscriptionPlans(): Promise<SubscriptionPlanConfig[]> {
  try {
    // Fetch and activate latest config
    await fetchAndActivate(remoteConfig);
    
    // Get subscription_plans parameter
    const plansValue = getValue(remoteConfig, 'subscription_plans');
    const plansJson = plansValue.asString();
    
    if (!plansJson) {
      const error = new Error('No subscription_plans parameter found in Remote Config');
      logger.error('No subscription_plans parameter found, using fallback constants', { feature: 'RemoteConfig', error });
      return DEFAULT_SUBSCRIPTION_PLANS.filter(plan => plan.enabled);
    }
    
    // Parse JSON
    const plansObject = JSON.parse(plansJson);
    
    // Validate structure
    if (!plansObject || typeof plansObject !== 'object') {
      const error = new Error('Invalid subscription plans structure in Remote Config');
      logger.error('Invalid subscription plans structure, using fallback constants', { feature: 'RemoteConfig', error });
      return DEFAULT_SUBSCRIPTION_PLANS.filter(plan => plan.enabled);
    }
    
    logger.info('Successfully loaded subscription plans from Remote Config', { feature: 'RemoteConfig' });
    return flattenPlans(plansObject);
  } catch (error) {
    logger.error('Error fetching subscription plans, using fallback constants', { feature: 'RemoteConfig', error });
    return DEFAULT_SUBSCRIPTION_PLANS.filter(plan => plan.enabled);
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

