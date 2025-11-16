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
 * Generic client-side event logger using Facebook SDK
 * 
 * Sends events directly to Facebook via the native SDK (AppEventsLogger).
 * This provides faster attribution but may be blocked by tracking prevention.
 * Always pair with server-side events for reliability.
 * 
 * @param eventName - Facebook event name (e.g., 'fb_mobile_activate_app')
 * @param eventId - Unique event ID for deduplication with server-side events
 * @param parameters - Optional event parameters to include
 * @internal
 */
async function logClientEvent(
  eventName: string,
  eventId: string,
  parameters?: Record<string, string>
): Promise<void> {
  // Check if SDK is available (not web, SDK loaded)
  if (!isClientSdkAvailable()) {
    logger.info(`Skipping ${eventName} (web or SDK not available)`, { feature: 'Facebook' });
    return;
  }

  try {
    // Prepare event parameters with event ID for deduplication
    const eventParams: Record<string, string> = {
      _eventId: eventId,
      ...parameters,
    };
    
    // Send event via Facebook SDK
    AppEventsLogger.logEvent(eventName, eventParams);
    
    logger.info(`${eventName} logged to Facebook`, { feature: 'Facebook', eventId });
  } catch (error) {
    logger.error(`Error logging ${eventName}`, { feature: 'Facebook', error });
    throw error;
  }
}

/**
 * Generic server-side event sender via Cloud Function
 * 
 * Sends events to Facebook Conversions API through a Cloud Function.
 * Server-side events are more reliable than client-side as they bypass tracking prevention.
 * 
 * @param eventName - Event name for Conversions API (e.g., 'AppInstall', 'AppLaunch')
 * @param eventId - Unique event ID for deduplication with client-side events
 * @param userData - Optional user data (email, phone, etc.) - will be hashed by Cloud Function
 * @param customData - Optional custom event parameters
 * @param attributionData - Optional attribution data from deep links (fbclid, utm params)
 * @internal
 */
async function sendServerEvent(
  eventName: string,
  eventId: string,
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
    // Delegate to sendConversionEvent which handles all the details
    await sendConversionEvent(eventId, eventName, userData, customData, attributionData);
    
    logger.info(`${eventName} event sent successfully`, { 
      feature: 'Facebook', 
      eventId,
      hasUserData: !!userData,
      hasAttribution: !!attributionData
    });
  } catch (error) {
    logger.error(`Error sending ${eventName} event`, { feature: 'Facebook', error });
    throw error;
  }
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
async function buildEventData(params: ConversionEventParams) {
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
    advertiserTrackingEnabled,
    applicationTrackingEnabled,
    extinfo,
    fbclid: params.attributionData?.fbclid || undefined,
    userData: params.userData,
    customData: params.customData,
  };
}

/**
 * Universal dual-send orchestrator (client + server in parallel)
 * 
 * Sends events to both client-side SDK and server-side Conversions API simultaneously.
 * This provides maximum reliability:
 * - Client-side: Faster attribution, may be blocked
 * - Server-side: Slower but more reliable, bypasses tracking prevention
 * 
 * Facebook automatically deduplicates events using the shared eventId.
 * The function succeeds if at least one destination receives the event.
 * 
 * @param eventName - Display name for logging (e.g., 'AppInstall', 'AppLaunch')
 * @param eventId - Unique event ID shared between client and server for deduplication
 * @param clientFn - Function that sends event via client SDK
 * @param serverFn - Function that sends event via server API
 * @internal
 */
async function sendEventDual(
  eventName: string,
  eventId: string,
  clientFn: () => Promise<void>,
  serverFn: () => Promise<void>
): Promise<void> {
  logger.info(`Sending ${eventName} event (dual-send)`, { 
    feature: 'Facebook', 
    eventId
  });
  
  // Send to both destinations in parallel using Promise.allSettled
  // This ensures both attempts complete even if one fails
  const results = await Promise.allSettled([
    clientFn(),
    serverFn()
  ]);
  
  // Analyze results
  const [clientResult, serverResult] = results;
  const clientSuccess = clientResult.status === 'fulfilled';
  const serverSuccess = serverResult.status === 'fulfilled';
  
  // Log individual results
  if (clientSuccess) {
    logger.info(`${eventName} client-side event sent successfully`, { feature: 'Facebook', eventId });
  } else {
    logger.warn(`${eventName} client-side event failed`, { 
      feature: 'Facebook', 
      eventId,
      error: clientResult.reason 
    });
  }
  
  if (serverSuccess) {
    logger.info(`${eventName} server-side event sent successfully`, { feature: 'Facebook', eventId });
  } else {
    logger.error(`${eventName} server-side event failed`, { 
      feature: 'Facebook', 
      eventId,
      error: serverResult.reason 
    });
  }
  
  // Throw error only if both destinations failed
  if (!clientSuccess && !serverSuccess) {
    throw new Error(`Both client and server ${eventName} events failed`);
  }
  
  // If only client failed but server succeeded, that's acceptable (server is more reliable)
  logger.info(`${eventName} dual-send completed`, { 
    feature: 'Facebook', 
    eventId,
    clientSuccess,
    serverSuccess
  });
}

// ============================================================================
// SDK Initialization
// ============================================================================

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
 * Log Activate App event to Facebook (client-side)
 * 
 * Sends official Facebook "Activate App" event which is used for both:
 * - First app launch (install) - with attribution parameters
 * - Subsequent launches - without attribution parameters
 * 
 * Facebook's backend automatically differentiates between install and launch events.
 * 
 * INTERNAL USE ONLY - Use sendAppInstallEventDual() or sendAppLaunchEventDual() instead
 * 
 * @param eventId - Event ID for deduplication between client and server
 * @param attributionData - Optional attribution data from deep link (include for first launch)
 */
async function logActivateAppEvent(
  eventId: string,
  attributionData?: AttributionData
): Promise<void> {
  // Build attribution parameters if provided (for install event)
  const parameters: Record<string, string> = {};
  
  if (attributionData) {
    if (attributionData.fbclid) {
      parameters.fbclid = attributionData.fbclid;
    }
    if (attributionData.utm_source) {
      parameters.utm_source = attributionData.utm_source;
    }
    if (attributionData.utm_medium) {
      parameters.utm_medium = attributionData.utm_medium;
    }
    if (attributionData.utm_campaign) {
      parameters.utm_campaign = attributionData.utm_campaign;
    }
    if (attributionData.email) {
      parameters.email = attributionData.email;
    }
  }
  
  // Delegate to generic client event logger
  await logClientEvent(
    FB_MOBILE_ACTIVATE_APP, 
    eventId, 
    Object.keys(parameters).length > 0 ? parameters : undefined
  );
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
      hasFbclid: !!attributionData?.fbclid,
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
 * Send AppInstall event to Facebook (Server-Side via Cloud Function)
 * 
 * Uses Facebook standard event 'fb_mobile_activate_app' with attribution data.
 * Facebook automatically identifies this as an install event based on context.
 * 
 * Simplified wrapper that uses sendServerEvent() helper.
 * Delegates server-side event sending with standardized error handling.
 * 
 * INTERNAL USE ONLY - Use sendAppInstallEventDual() instead
 * 
 * @param eventId - Event ID for deduplication between client and server
 * @param userData - User data for the event
 * @param attributionData - Attribution data from deep link
 */
async function sendAppInstallEvent(
  eventId: string,
  userData?: {
    email?: string;
  },
  attributionData?: AttributionData
): Promise<void> {
  // Delegate to generic server event sender with standard Facebook event name
  await sendServerEvent(FB_MOBILE_ACTIVATE_APP, eventId, userData, undefined, attributionData);
}

/**
 * Send AppLaunch event to Facebook (Server-Side via Cloud Function)
 * 
 * Uses Facebook standard event 'fb_mobile_activate_app' for app launches.
 * Same event as install, but without attribution data (subsequent launches).
 * 
 * Simplified wrapper that uses sendServerEvent() helper.
 * Delegates server-side event sending with standardized error handling.
 * 
 * INTERNAL USE ONLY - Use sendAppLaunchEventDual() instead
 * 
 * @param eventId - Event ID for deduplication between client and server
 * @param userData - User data for the event
 * @param attributionData - Attribution data from deep link
 */
async function sendAppLaunchEvent(
  eventId: string,
  userData?: {
    email?: string;
  },
  attributionData?: AttributionData
): Promise<void> {
  // Delegate to generic server event sender with standard Facebook event name
  await sendServerEvent(FB_MOBILE_ACTIVATE_APP, eventId, userData, undefined, attributionData);
}

/**
 * Send AppInstall event to both client and server with shared event ID for deduplication
 * 
 * Simplified wrapper that uses sendEventDual() helper for parallel client/server sending.
 * This is the recommended way to send AppInstall events as it ensures proper deduplication.
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
  // Generate shared event ID for deduplication
  const eventId = generateEventId();
  
  // Use generic dual-send helper with closures that capture the necessary data
  await sendEventDual(
    'AppInstall',
    eventId,
    // Client-side function: pass eventId to logActivateAppEvent with attribution data
    async () => logActivateAppEvent(eventId, attributionData),
    // Server-side function: pass eventId to sendAppInstallEvent
    async () => sendAppInstallEvent(eventId, userData, attributionData)
  );
}

/**
 * Send AppLaunch event to both client and server with shared event ID for deduplication
 * 
 * Simplified wrapper that uses sendEventDual() helper for parallel client/server sending.
 * This is the recommended way to send AppLaunch events as it ensures proper deduplication.
 * 
 * @param attributionData - Optional attribution data from deep link (fbclid, utm params)
 * @param userData - Optional user data (email) for server-side event
 */
export async function sendAppLaunchEventDual(
  attributionData?: AttributionData,
  userData?: {
    email?: string;
  }
): Promise<void> {
  // Generate shared event ID for deduplication
  const eventId = generateEventId();
  
  // Use generic dual-send helper with closures that capture the necessary data
  await sendEventDual(
    'AppLaunch',
    eventId,
    // Client-side function: pass eventId to logActivateAppEvent (no attribution data for subsequent launches)
    async () => logActivateAppEvent(eventId),
    // Server-side function: pass eventId to sendAppLaunchEvent
    async () => sendAppLaunchEvent(eventId, userData, attributionData)
  );
}
