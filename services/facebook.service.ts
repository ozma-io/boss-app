import { FACEBOOK_CONFIG } from '@/constants/facebook.config';
import { functions } from '@/constants/firebase.config';
import { logger } from '@/services/logger.service';
import { buildExtinfo, getAdvertiserTrackingEnabled, getApplicationTrackingEnabledSync } from '@/utils/deviceInfo';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import { AttributionData } from './attribution.service';

// Conditionally import Facebook SDK only on native platforms
let Settings: any;
let AppEventsLogger: any;

if (Platform.OS !== 'web') {
  try {
    const fbsdk = require('react-native-fbsdk-next');
    Settings = fbsdk.Settings;
    AppEventsLogger = fbsdk.AppEventsLogger;
  } catch (error) {
    logger.warn('react-native-fbsdk-next not available', { feature: 'Facebook', error });
  }
}

/**
 * Initialize Facebook SDK
 */
export async function initializeFacebookSdk(): Promise<void> {
  // Skip on web
  if (Platform.OS === 'web') {
    logger.info('Skipping SDK initialization on web', { feature: 'Facebook' });
    return;
  }

  if (!Settings) {
    logger.warn('Facebook SDK not available, skipping initialization', { feature: 'Facebook' });
    return;
  }

  try {
    if (!FACEBOOK_CONFIG.appId) {
      logger.warn('Facebook App ID not configured, skipping initialization', { feature: 'Facebook' });
      return;
    }

    // Configure Facebook SDK settings
    Settings.setAppID(FACEBOOK_CONFIG.appId);
    Settings.setAppName(FACEBOOK_CONFIG.appName);
    
    if (FACEBOOK_CONFIG.autoLogAppEvents) {
      Settings.setAutoLogAppEventsEnabled(true);
    }
    
    if (FACEBOOK_CONFIG.advertiserIDCollectionEnabled) {
      Settings.setAdvertiserIDCollectionEnabled(true);
    }

    // Initialize App Events
    await Settings.initializeSDK();
    
    logger.info('SDK initialized successfully', { feature: 'Facebook' });
  } catch (error) {
    logger.error('Error initializing SDK', { feature: 'Facebook', error });
    throw error;
  }
}

/**
 * Fetch deferred deep link from Facebook SDK
 * This retrieves the deep link that caused the app install
 */
export async function fetchDeferredAppLink(): Promise<string | null> {
  try {
    // Note: react-native-fbsdk-next doesn't expose fetchDeferredAppLink directly
    // We need to use native modules or rely on regular deep linking via Linking API
    // The deferred deep link will be available through the regular deep link mechanism
    // after the Facebook SDK processes it on the native side
    
    logger.info('Deferred deep link fetch attempted (handled by native SDK)', { feature: 'Facebook' });
    return null;
  } catch (error) {
    logger.error('Error fetching deferred app link', { feature: 'Facebook', error });
    return null;
  }
}

/**
 * Parse deep link parameters from URL
 */
export function parseDeepLinkParams(url: string): AttributionData {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;
    
    const attributionData: AttributionData = {
      fbclid: params.get('fbclid'),
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_content: params.get('utm_content'),
      utm_term: params.get('utm_term'),
      email: params.get('email'),
      appUserId: params.get('app_user_id'),
    };
    
    logger.info('Parsed deep link params', { feature: 'Facebook', attributionData });
    return attributionData;
  } catch (error) {
    logger.error('Error parsing deep link params', { feature: 'Facebook', error });
    return {};
  }
}

/**
 * Log AppInstall event to Facebook (client-side)
 */
export async function logAppInstallEvent(attributionData: AttributionData): Promise<void> {
  // Skip on web or if SDK not available
  if (Platform.OS === 'web' || !AppEventsLogger) {
    logger.info('Skipping AppInstall event (web or SDK not available)', { feature: 'Facebook' });
    return;
  }

  try {
    const eventParams: Record<string, string> = {};
    
    // Add attribution data to event parameters
    if (attributionData.fbclid) {
      eventParams.fbclid = attributionData.fbclid;
    }
    if (attributionData.utm_source) {
      eventParams.utm_source = attributionData.utm_source;
    }
    if (attributionData.utm_medium) {
      eventParams.utm_medium = attributionData.utm_medium;
    }
    if (attributionData.utm_campaign) {
      eventParams.utm_campaign = attributionData.utm_campaign;
    }
    if (attributionData.email) {
      eventParams.email = attributionData.email;
    }
    
    // Log the event - SDK will handle advertiserTrackingEnabled flag automatically
    AppEventsLogger.logEvent('fb_mobile_activate_app', eventParams);
    
    logger.info('AppInstall event logged to Facebook', { feature: 'Facebook', eventParams });
  } catch (error) {
    logger.error('Error logging AppInstall event', { feature: 'Facebook', error });
    throw error;
  }
}

/**
 * Log AppLaunch event to Facebook (client-side)
 */
export async function logAppLaunchEvent(): Promise<void> {
  // Skip on web or if SDK not available
  if (Platform.OS === 'web' || !AppEventsLogger) {
    logger.info('Skipping AppLaunch event (web or SDK not available)', { feature: 'Facebook' });
    return;
  }

  try {
    // Log the event - SDK will handle advertiserTrackingEnabled flag automatically
    AppEventsLogger.logEvent('fb_mobile_app_launch');
    
    logger.info('AppLaunch event logged to Facebook', { feature: 'Facebook' });
  } catch (error) {
    logger.error('Error logging AppLaunch event', { feature: 'Facebook', error });
    throw error;
  }
}

/**
 * Log custom event to Facebook
 */
export async function logCustomEvent(
  eventName: string,
  parameters?: Record<string, string | number>
): Promise<void> {
  // Skip on web or if SDK not available
  if (Platform.OS === 'web' || !AppEventsLogger) {
    logger.info('Skipping custom event (web or SDK not available)', { feature: 'Facebook', eventName });
    return;
  }

  try {
    // Log the event - SDK will handle advertiserTrackingEnabled flag automatically
    if (parameters) {
      AppEventsLogger.logEvent(eventName, parameters);
    } else {
      AppEventsLogger.logEvent(eventName);
    }
    
    logger.info('Custom event logged', { feature: 'Facebook', eventName, parameters });
  } catch (error) {
    logger.error('Error logging custom event', { feature: 'Facebook', error });
    throw error;
  }
}

/**
 * Generate a unique event ID for deduplication between client and server events
 */
export function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Send conversion event to Facebook via Cloud Function (Server-Side)
 * This provides more reliable tracking compared to client-side only
 */
export async function sendConversionEvent(
  eventName: string,
  userData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  },
  customData?: Record<string, string | number | boolean>,
  attributionData?: AttributionData
): Promise<void> {
  try {
    // Build extinfo array with device information
    const extinfo = await buildExtinfo();
    
    // Get tracking permissions
    let advertiserTrackingEnabled = false;
    
    if (Platform.OS === 'ios') {
      // On iOS, we need to respect the ATT permission
      const { getTrackingPermissionStatus } = await import('@/services/tracking.service');
      const status = await getTrackingPermissionStatus();
      advertiserTrackingEnabled = status === 'authorized';
    } else {
      // On Android, we use the old implementation
      advertiserTrackingEnabled = await getAdvertiserTrackingEnabled();
    }
    
    // Application tracking is whether we have user's consent to track in the app
    // We use the synchronous version here as this function is already async
    const applicationTrackingEnabled = getApplicationTrackingEnabledSync();
    
    // Generate unique event ID for deduplication
    const eventId = generateEventId();
    
    // Prepare event data
    const eventData = {
      eventName,
      eventTime: Math.floor(Date.now() / 1000),
      eventId,
      advertiserTrackingEnabled,
      applicationTrackingEnabled,
      extinfo,
      fbclid: attributionData?.fbclid || undefined,
      userData,
      customData,
    };
    
    logger.info('Sending conversion event to Cloud Function', {
      feature: 'Facebook',
      eventName,
      eventId,
      hasUserData: !!userData,
      hasFbclid: !!attributionData?.fbclid,
    });
    
    // Call Cloud Function
    const sendEventFunction = httpsCallable(functions, 'sendFacebookConversionEvent');
    const result = await sendEventFunction(eventData);
    
    logger.info('Conversion event sent successfully', { feature: 'Facebook', result: result.data });
  } catch (error) {
    logger.error('Error sending conversion event', { feature: 'Facebook', error });
    throw error;
  }
}

/**
 * Send AppInstall event to Facebook (Server-Side via Cloud Function)
 * Should be called on first app launch after attribution is collected
 */
export async function sendAppInstallEvent(
  userData?: {
    email?: string;
  },
  attributionData?: AttributionData
): Promise<void> {
  try {
    await sendConversionEvent('AppInstall', userData, undefined, attributionData);
    logger.info('AppInstall event sent successfully', { feature: 'Facebook' });
  } catch (error) {
    logger.error('Error sending AppInstall event', { feature: 'Facebook', error });
    throw error;
  }
}

/**
 * Send AppLaunch event to Facebook (Server-Side via Cloud Function)
 * Should be called on every app launch
 */
export async function sendAppLaunchEvent(
  userData?: {
    email?: string;
  },
  attributionData?: AttributionData
): Promise<void> {
  try {
    await sendConversionEvent('AppLaunch', userData, undefined, attributionData);
    logger.info('AppLaunch event sent successfully', { 
      feature: 'Facebook', 
      hasUserData: !!userData,
      hasAttribution: !!attributionData
    });
  } catch (error) {
    logger.error('Error sending AppLaunch event', { feature: 'Facebook', error });
    throw error;
  }
}

/**
 * Send first launch events (App Install + App Launch)
 * Should be called only on first app launch with attribution data
 */
export async function sendFirstLaunchEvents(attributionData: AttributionData): Promise<void> {
  try {
    // Send App Install events
    await logAppInstallEvent(attributionData);
    await sendAppInstallEvent(
      attributionData.email ? { email: attributionData.email } : undefined,
      attributionData
    );
    logger.info('App Install events sent', { feature: 'Facebook' });
    
    // Send App Launch events immediately after
    await logAppLaunchEvent();
    await sendAppLaunchEvent(
      attributionData.email ? { email: attributionData.email } : undefined,
      attributionData
    );
    logger.info('App Launch events sent', { feature: 'Facebook' });
  } catch (error) {
    logger.error('Error sending first launch events', { feature: 'Facebook', error });
    throw error;
  }
}

