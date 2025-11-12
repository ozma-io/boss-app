import { app } from '@/constants/firebase.config';
import { SubscriptionPlanConfig } from '@/types';
import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config';

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
    console.log('[RemoteConfig] Successfully fetched and activated');
  } catch (error) {
    console.error('[RemoteConfig] Failed to fetch and activate:', error);
    throw error;
  }
}

/**
 * Fetch subscription plans from Remote Config
 * Throws error if Remote Config unavailable or parsing fails
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
      console.error('[RemoteConfig]', error.message);
      throw error;
    }
    
    // Parse JSON
    const plansObject = JSON.parse(plansJson);
    
    // Validate structure
    if (!plansObject || typeof plansObject !== 'object') {
      const error = new Error('Invalid subscription plans structure in Remote Config');
      console.error('[RemoteConfig]', error.message);
      throw error;
    }
    
    console.log('[RemoteConfig] Successfully loaded subscription plans from Remote Config');
    return flattenPlans(plansObject);
  } catch (error) {
    console.error('[RemoteConfig] Error fetching subscription plans:', error);
    throw error;
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

