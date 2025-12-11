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

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Parameters for building conversion event data
 * Used by buildEventData() helper to construct Conversions API payloads
 */
interface ConversionEventParams {
  eventName: string;
  eventId: string;
  userData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  };
  customData?: Record<string, string | number | boolean>;
  attributionData?: AttributionData;
}

/**
 * Complete event data payload for Facebook Conversions API
 * Returned by buildEventData() and sent to Cloud Function for server-side tracking
 */
interface ConversionEventData {
  eventName: string;
  eventTime: number;
  eventId: string;
  actionSource: 'app' | 'website' | 'email' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'business_messaging' | 'other';
  advertiserTrackingEnabled: boolean;
  applicationTrackingEnabled: boolean;
  extinfo: string[];
  fbc?: string;
  fbp?: string;
  userData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  };
  customData?: Record<string, string | number | boolean>;
}

// ============================================================================
// Facebook Standard Events
// ============================================================================

/**
 * Official Facebook mobile app events
 * 
 * IMPORTANT: Only official Facebook events should be added here.
 * Custom events are NOT allowed to ensure proper attribution and analytics.
 * 
 * Currently used:
 * - fb_mobile_activate_app - Official "Activate App" event for app launch
 *   (used for both first launch and subsequent launches - Facebook differentiates automatically)
 * 
 * Note: There is NO separate fb_mobile_app_launch event in Facebook's official SDK.
 * The "Activate App" event is the only standard event for tracking app opens.
 * The "Install" event is sent via Conversions API (server-side) only.
 * 
 * To add more events, refer to Facebook SDK official documentation:
 * @see https://developers.facebook.com/docs/app-events/reference
 */
const FB_MOBILE_ACTIVATE_APP = 'fb_mobile_activate_app';

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * Check if Facebook SDK is available for client-side events
 * 
 * The Facebook SDK (AppEventsLogger) is only available on native platforms (iOS/Android).
 * This helper centralizes the availability check used across all client-side event functions.
 * 
 * @returns True if SDK is available and can be used, false otherwise
 * @internal
 */
function isClientSdkAvailable(): boolean {
  return Platform.OS !== 'web' && !!AppEventsLogger;
}



/**
 * Build event data payload for Facebook Conversions API
 * 
 * Constructs the complete event data object required by Conversions API, including:
 * - Device information (extinfo array)
 * - Tracking permissions (advertiserTrackingEnabled, applicationTrackingEnabled)
 * - Event metadata (name, time, ID)
 * - User and custom data
 * 
 * @param params - Event parameters including name, ID, user data, and attribution
 * @returns Complete event data object ready for Conversions API
 * @internal
 */
async function buildEventData(params: ConversionEventParams): Promise<ConversionEventData> {
  // Build 16-element device info array required by Facebook
  const extinfo = await buildExtinfo();
  
  // Get tracking permissions based on platform
  let advertiserTrackingEnabled = false;
  
  if (Platform.OS === 'ios') {
    // On iOS, respect ATT (App Tracking Transparency) permission
    const { getTrackingPermissionStatus } = await import('@/services/tracking.service');
    const status = await getTrackingPermissionStatus();
    advertiserTrackingEnabled = status === 'authorized';
  } else {
    // On Android, use device info utility
    advertiserTrackingEnabled = await getAdvertiserTrackingEnabled();
  }
  
  // Application tracking is whether we have user's consent to track in the app
  const applicationTrackingEnabled = getApplicationTrackingEnabledSync();
  
  // Construct event data payload
  return {
    eventName: params.eventName,
    eventTime: Math.floor(Date.now() / 1000), // Unix timestamp
    eventId: params.eventId,
    actionSource: 'app' as const,
    advertiserTrackingEnabled,
    applicationTrackingEnabled,
    extinfo,
    // Facebook Conversions API requires formatted cookies (NOT raw fbclid):
    // - fbc: "fb.1.timestamp.fbclid" (contains fbclid inside, used for attribution)
    // - fbp: "fb.1.timestamp.random" (browser identifier)
    // Raw fbclid is NOT accepted in user_data by Facebook - must be formatted as fbc
    fbc: params.attributionData?.fbc || undefined,
    fbp: params.attributionData?.fbp || undefined,
    userData: params.userData,
    customData: params.customData,
  };
}


// ============================================================================
// SDK Initialization
// ============================================================================

/**
 * Initialize Facebook SDK
 * 
 * Best practice timing:
 * - Android: Can be called early (no ATT requirements)
 * - iOS: Should be called AFTER requestTrackingPermission() for proper IDFA usage
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
    // Note: On iOS, this should be called AFTER ATT permission for best practices
    await Settings.initializeSDK();
    
    logger.info('SDK initialized successfully', { 
      feature: 'Facebook', 
      platform: Platform.OS,
      autoLogAppEvents: FACEBOOK_CONFIG.autoLogAppEvents,
      advertiserIDCollection: FACEBOOK_CONFIG.advertiserIDCollectionEnabled
    });
  } catch (error) {
    logger.error('Error initializing SDK', { feature: 'Facebook', error });
    throw error;
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
      fbc: params.get('fbc'),
      fbp: params.get('fbp'),
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
 * Generate a unique event ID for deduplication between client and server events
 */
export function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Send conversion event to Facebook via Cloud Function (Server-Side)
 * 
 * Simplified implementation that uses buildEventData() helper to construct the payload.
 * This provides more reliable tracking compared to client-side only.
 * 
 * @param eventId - Event ID for deduplication between client and server
 * @param eventName - Name of the event (e.g., 'AppInstall', 'AppLaunch')
 * @param userData - User data for the event (will be hashed by Cloud Function)
 * @param customData - Custom event data (e.g., currency, value)
 * @param attributionData - Attribution data from deep link (fbclid, utm params)
 */
export async function sendConversionEvent(
  eventId: string,
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
    // Build complete event data payload using helper
    const eventData = await buildEventData({
      eventId,
      eventName,
      userData,
      customData,
      attributionData,
    });
    
    logger.info('Sending conversion event to Cloud Function', {
      feature: 'Facebook',
      eventName,
      eventId,
      hasUserData: !!userData,
      hasFbc: !!attributionData?.fbc,
      hasFbp: !!attributionData?.fbp
    });
    
    // Call Cloud Function to send event to Facebook Conversions API
    const sendEventFunction = httpsCallable(functions, 'sendFacebookConversionEvent');
    const result = await sendEventFunction(eventData);
    
    logger.info('Conversion event sent successfully', { feature: 'Facebook', result: result.data });
  } catch (error) {
    logger.error('Error sending conversion event', { feature: 'Facebook', error });
    throw error;
  }
}



/**
 * Send AppInstall event to both client and server with shared event ID for deduplication
 * 
 * Sends Facebook "Activate App" event with attribution data for proper campaign tracking.
 * Uses dual-send approach (client + server) for maximum reliability.
 * 
 * @param attributionData - Attribution data from deep link (fbclid, utm params, email)
 * @param userData - Optional user data (email) for server-side event
 */
export async function sendAppInstallEventDual(
  attributionData: AttributionData,
  userData?: {
    email?: string;
  }
): Promise<void> {
  const eventId = generateEventId();
  
  logger.info('Sending AppInstall event (dual-send)', { 
    feature: 'Facebook', 
    eventId,
    hasFbc: !!attributionData.fbc,
    hasFbp: !!attributionData.fbp
  });
  
  // Build attribution parameters for client-side event
  const clientParams: Record<string, string> = { _eventId: eventId };
  if (attributionData.fbclid) clientParams.fbclid = attributionData.fbclid;
  if (attributionData.utm_source) clientParams.utm_source = attributionData.utm_source;
  if (attributionData.utm_medium) clientParams.utm_medium = attributionData.utm_medium;
  if (attributionData.utm_campaign) clientParams.utm_campaign = attributionData.utm_campaign;
  if (attributionData.email) clientParams.email = attributionData.email;
  
  // Send to both client and server in parallel
  const results = await Promise.allSettled([
    // Client-side: Facebook SDK
    (async () => {
      if (isClientSdkAvailable()) {
        AppEventsLogger.logEvent(FB_MOBILE_ACTIVATE_APP, clientParams);
        logger.info('AppInstall client-side sent', { feature: 'Facebook', eventId });
      }
    })(),
    
    // Server-side: Conversions API via Cloud Function
    sendConversionEvent(eventId, FB_MOBILE_ACTIVATE_APP, userData, undefined, attributionData)
  ]);
  
  // Check results
  const [clientResult, serverResult] = results;
  const clientSuccess = clientResult.status === 'fulfilled';
  const serverSuccess = serverResult.status === 'fulfilled';
  
  if (!clientSuccess && !serverSuccess) {
    throw new Error('Both client and server AppInstall events failed');
  }
  
  logger.info('AppInstall dual-send completed', { 
    feature: 'Facebook', 
    eventId,
    clientSuccess,
    serverSuccess
  });
}

/**
 * Send registration event to Facebook for organic users (Advanced Matching)
 * 
 * Sends fb_mobile_complete_registration event with email for Custom Audiences and Lookalike targeting.
 * This helps Facebook identify your users for better campaign optimization.
 * 
 * @param email - User email for Advanced Matching (will be hashed automatically)
 * @param attributionData - Optional attribution data from Firestore (fbclid, fbc, fbp from web-funnel)
 */
export async function sendRegistrationEventDual(email: string, attributionData?: AttributionData): Promise<void> {
  const eventId = generateEventId();
  
  logger.info('Sending Registration event', { 
    feature: 'Facebook', 
    eventId,
    hasEmail: !!email,
    hasAttributionData: !!attributionData,
    hasFbc: !!attributionData?.fbc,
    hasFbp: !!attributionData?.fbp
  });
  
  // Client params with email for Advanced Matching
  const clientParams: Record<string, string> = { 
    _eventId: eventId,
    registration_method: 'email'
  };
  
  // Send to both client and server in parallel
  const results = await Promise.allSettled([
    // Client-side: Facebook SDK
    (async () => {
      if (isClientSdkAvailable()) {
        AppEventsLogger.logEvent('fb_mobile_complete_registration', clientParams);
        logger.info('Registration client-side sent', { feature: 'Facebook', eventId });
      }
    })(),
    
    // Server-side: Conversions API with email + attribution (fbc, fbp, fbclid from Firestore)
    sendConversionEvent(eventId, 'fb_mobile_complete_registration', { email }, { registration_method: 'email' }, attributionData)
  ]);
  
  // Check results  
  const [clientResult, serverResult] = results;
  const clientSuccess = clientResult.status === 'fulfilled';
  const serverSuccess = serverResult.status === 'fulfilled';
  
  if (!clientSuccess && !serverSuccess) {
    throw new Error('Both client and server Registration events failed');
  }
  
  logger.info('Registration dual-send completed', { 
    feature: 'Facebook', 
    eventId,
    clientSuccess,
    serverSuccess
  });
}

