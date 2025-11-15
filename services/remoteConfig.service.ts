import { remoteConfig as webRemoteConfig } from '@/constants/firebase.config';
import { DEFAULT_SUBSCRIPTION_PLANS } from '@/constants/subscriptionPlans';
import { SubscriptionPlanConfig } from '@/types';
import { Platform } from 'react-native';
import { logger } from './logger.service';

// Platform-specific: Native uses React Native Firebase
//
// MIGRATION NOTE: React Native Firebase v12+ Modular API
// -------------------------------------------------------
// ❌ OLD (deprecated namespace API - causes warnings):
//    const remoteConfig = require('@react-native-firebase/remote-config').default;
//    const config = remoteConfig(); // Uses deprecated .app() internally
//    config.getValue('key')
//    config.setConfigSettings(settings)
//    config.fetchAndActivate()
//
// ✅ NEW (modular API - no warnings):
//    const { getRemoteConfig, getValue, setConfigSettings, fetchAndActivate } = require('@react-native-firebase/remote-config');
//    const config = getRemoteConfig()
//    getValue(config, 'key')
//    setConfigSettings(config, settings)
//    fetchAndActivate(config)
//
// See migration guide: https://rnfirebase.io/migrating-to-v12
let nativeGetRemoteConfig: any = null;
let nativeGetValue: any = null;
let nativeSetConfigSettings: any = null;
let nativeFetchAndActivate: any = null;
if (Platform.OS !== 'web') {
  // iOS/Android: use React Native Firebase modular API
  const remoteConfigModule = require('@react-native-firebase/remote-config');
  nativeGetRemoteConfig = remoteConfigModule.getRemoteConfig;
  nativeGetValue = remoteConfigModule.getValue;
  nativeSetConfigSettings = remoteConfigModule.setConfigSettings;
  nativeFetchAndActivate = remoteConfigModule.fetchAndActivate;
}

/**
 * Initialize Remote Config and fetch latest values
 */
export async function initRemoteConfig(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      // Web: use Firebase Web SDK
      if (!webRemoteConfig) {
        throw new Error('Remote Config not available on web platform');
      }
      const { fetchAndActivate } = require('firebase/remote-config');
      await fetchAndActivate(webRemoteConfig);
      logger.info('Successfully fetched and activated Remote Config', { 
        feature: 'RemoteConfig',
        platform: 'web'
      });
    } else {
      // iOS/Android: use React Native Firebase modular API
      // Get remote config instance using modular API (not deprecated default())
      const config = nativeGetRemoteConfig();
      
      // Set config settings - modular API: setConfigSettings(config, settings)
      await nativeSetConfigSettings(config, {
        minimumFetchIntervalMillis: __DEV__ ? 0 : 3600000,
      });
      
      // Fetch and activate - modular API: fetchAndActivate(config)
      await nativeFetchAndActivate(config);
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
      if (!webRemoteConfig) {
        logger.warn('Remote Config not available on web, using fallback constants', { 
          feature: 'RemoteConfig',
          platform: 'web'
        });
        return DEFAULT_SUBSCRIPTION_PLANS.filter(plan => plan.enabled);
      }
      
      const { fetchAndActivate, getValue } = require('firebase/remote-config');
      await fetchAndActivate(webRemoteConfig);
      const plansValue = getValue(webRemoteConfig, 'subscription_plans');
      plansJson = plansValue.asString();
    } else {
      // iOS/Android: use React Native Firebase modular API
      const config = nativeGetRemoteConfig();
      await nativeFetchAndActivate(config);
      // Get value using modular API: getValue(config, key) - sync, not async!
      // OLD: config.getValue('subscription_plans').asString() ❌
      // NEW: getValue(config, 'subscription_plans').asString() ✅
      const valueSnapshot = nativeGetValue(config, 'subscription_plans');
      plansJson = valueSnapshot.asString();
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

