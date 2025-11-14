import { DEFAULT_SUBSCRIPTION_PLANS } from '@/constants/subscriptionPlans';
import { SubscriptionPlanConfig } from '@/types';
import { Platform } from 'react-native';
import { logger } from './logger.service';

// Platform-specific imports
let remoteConfig: any = null;
let nativeRemoteConfig: any = null;

if (Platform.OS === 'web') {
  // Web: use Firebase Web SDK
  const { app } = require('@/constants/firebase.config');
  const { getRemoteConfig, fetchAndActivate: webFetchAndActivate, getValue: webGetValue } = require('firebase/remote-config');
  remoteConfig = getRemoteConfig(app);
  
  // Configure Remote Config for web
  remoteConfig.settings.minimumFetchIntervalMillis = __DEV__ 
    ? 0  // No cache in development
    : 3600000; // 1 hour cache in production
} else {
  // iOS/Android: use React Native Firebase
  nativeRemoteConfig = require('@react-native-firebase/remote-config').default;
}

/**
 * Initialize Remote Config and fetch latest values
 */
export async function initRemoteConfig(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      // Web: use Firebase Web SDK
      const { fetchAndActivate } = require('firebase/remote-config');
      await fetchAndActivate(remoteConfig);
      logger.info('Successfully fetched and activated Remote Config', { 
        feature: 'RemoteConfig',
        platform: 'web'
      });
    } else {
      // iOS/Android: use React Native Firebase
      const config = nativeRemoteConfig();
      
      // Set config settings
      await config.setConfigSettings({
        minimumFetchIntervalMillis: __DEV__ ? 0 : 3600000,
      });
      
      // Fetch and activate
      await config.fetchAndActivate();
      logger.info('Successfully fetched and activated Remote Config', { 
        feature: 'RemoteConfig',
        platform: Platform.OS
      });
    }
  } catch (error) {
    logger.error('Failed to fetch and activate Remote Config', { 
      feature: 'RemoteConfig', 
      platform: Platform.OS,
      error 
    });
    throw error;
  }
}

/**
 * Fetch subscription plans from Remote Config
 * Falls back to DEFAULT_SUBSCRIPTION_PLANS if Remote Config unavailable or parsing fails
 */
export async function fetchSubscriptionPlans(): Promise<SubscriptionPlanConfig[]> {
  try {
    let plansJson: string = '';
    
    if (Platform.OS === 'web') {
      // Web: use Firebase Web SDK
      const { fetchAndActivate, getValue } = require('firebase/remote-config');
      await fetchAndActivate(remoteConfig);
      const plansValue = getValue(remoteConfig, 'subscription_plans');
      plansJson = plansValue.asString();
    } else {
      // iOS/Android: use React Native Firebase
      const config = nativeRemoteConfig();
      await config.fetchAndActivate();
      plansJson = config.getValue('subscription_plans').asString();
    }
    
    if (!plansJson) {
      const error = new Error('No subscription_plans parameter found in Remote Config');
      logger.error('No subscription_plans parameter found, using fallback constants', { 
        feature: 'RemoteConfig',
        platform: Platform.OS,
        error 
      });
      return DEFAULT_SUBSCRIPTION_PLANS.filter(plan => plan.enabled);
    }
    
    // Parse JSON
    const plansObject = JSON.parse(plansJson);
    
    // Validate structure
    if (!plansObject || typeof plansObject !== 'object') {
      const error = new Error('Invalid subscription plans structure in Remote Config');
      logger.error('Invalid subscription plans structure, using fallback constants', { 
        feature: 'RemoteConfig',
        platform: Platform.OS,
        error 
      });
      return DEFAULT_SUBSCRIPTION_PLANS.filter(plan => plan.enabled);
    }
    
    logger.info('Successfully loaded subscription plans from Remote Config', { 
      feature: 'RemoteConfig',
      platform: Platform.OS
    });
    return flattenPlans(plansObject);
  } catch (error) {
    logger.error('Error fetching subscription plans, using fallback constants', { 
      feature: 'RemoteConfig',
      platform: Platform.OS,
      error 
    });
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

