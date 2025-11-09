import { Platform } from 'react-native';
import { FACEBOOK_CONFIG } from '@/constants/facebook.config';
import { AttributionData } from './attribution.service';
import { functions } from '@/constants/firebase.config';
import { httpsCallable } from 'firebase/functions';
import { buildExtinfo, getAdvertiserTrackingEnabled, getApplicationTrackingEnabled } from '@/utils/deviceInfo';

// Conditionally import Facebook SDK only on native platforms
let Settings: any;
let AppEventsLogger: any;

if (Platform.OS !== 'web') {
  try {
    const fbsdk = require('react-native-fbsdk-next');
    Settings = fbsdk.Settings;
    AppEventsLogger = fbsdk.AppEventsLogger;
  } catch (error) {
    console.warn('[Facebook] react-native-fbsdk-next not available');
  }
}

/**
 * Initialize Facebook SDK
 */
export async function initializeFacebookSdk(): Promise<void> {
  // Skip on web
  if (Platform.OS === 'web') {
    console.log('[Facebook] Skipping SDK initialization on web');
    return;
  }

  if (!Settings) {
    console.warn('[Facebook] Facebook SDK not available, skipping initialization');
    return;
  }

  try {
    if (!FACEBOOK_CONFIG.appId) {
      console.warn('[Facebook] Facebook App ID not configured, skipping initialization');
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
    
    console.log('[Facebook] SDK initialized successfully');
  } catch (error) {
    console.error('[Facebook] Error initializing SDK:', error);
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
    
    console.log('[Facebook] Deferred deep link fetch attempted (handled by native SDK)');
    return null;
  } catch (error) {
    console.error('[Facebook] Error fetching deferred app link:', error);
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
    
    console.log('[Facebook] Parsed deep link params:', attributionData);
    return attributionData;
  } catch (error) {
    console.error('[Facebook] Error parsing deep link params:', error);
    return {};
  }
}

/**
 * Log AppInstall event to Facebook (client-side)
 */
export async function logAppInstallEvent(attributionData: AttributionData): Promise<void> {
  // Skip on web or if SDK not available
  if (Platform.OS === 'web' || !AppEventsLogger) {
    console.log('[Facebook] Skipping AppInstall event (web or SDK not available)');
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
    
    // Log the event
    AppEventsLogger.logEvent('fb_mobile_activate_app', eventParams);
    
    console.log('[Facebook] AppInstall event logged to Facebook:', eventParams);
  } catch (error) {
    console.error('[Facebook] Error logging AppInstall event:', error);
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
    console.log('[Facebook] Skipping custom event (web or SDK not available):', eventName);
    return;
  }

  try {
    if (parameters) {
      AppEventsLogger.logEvent(eventName, parameters);
    } else {
      AppEventsLogger.logEvent(eventName);
    }
    
    console.log('[Facebook] Custom event logged:', eventName, parameters);
  } catch (error) {
    console.error('[Facebook] Error logging custom event:', error);
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
    const advertiserTrackingEnabled = await getAdvertiserTrackingEnabled();
    const applicationTrackingEnabled = getApplicationTrackingEnabled();
    
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
    
    console.log('[Facebook] Sending conversion event to Cloud Function:', {
      eventName,
      eventId,
      hasUserData: !!userData,
      hasFbclid: !!attributionData?.fbclid,
    });
    
    // Call Cloud Function
    const sendEventFunction = httpsCallable(functions, 'sendFacebookConversionEvent');
    const result = await sendEventFunction(eventData);
    
    console.log('[Facebook] Conversion event sent successfully:', result.data);
  } catch (error) {
    console.error('[Facebook] Error sending conversion event:', error);
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
    console.log('[Facebook] AppInstall event sent successfully');
  } catch (error) {
    console.error('[Facebook] Error sending AppInstall event:', error);
    throw error;
  }
}

