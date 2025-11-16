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
 * INTERNAL USE ONLY - Use sendAppInstallEventDual() instead
 * @param attributionData - Attribution data from deep link
 * @param eventId - Event ID for deduplication between client and server
 */
async function logAppInstallEvent(
  attributionData: AttributionData,
  eventId: string
): Promise<void> {
  // Skip on web or if SDK not available
  if (Platform.OS === 'web' || !AppEventsLogger) {
    logger.info('Skipping AppInstall event (web or SDK not available)', { feature: 'Facebook' });
    return;
  }

  try {
    const eventParams: Record<string, string> = {};
    
    // Add event ID for deduplication between client and server
    eventParams._eventId = eventId;
    
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
    
    logger.info('AppInstall event logged to Facebook', { feature: 'Facebook', eventParams, eventId });
  } catch (error) {
    logger.error('Error logging AppInstall event', { feature: 'Facebook', error });
    throw error;
  }
}

/**
 * Log AppLaunch event to Facebook (client-side)
 * INTERNAL USE ONLY - Use sendAppLaunchEventDual() instead
 * @param eventId - Event ID for deduplication between client and server
 */
async function logAppLaunchEvent(eventId: string): Promise<void> {
  // Skip on web or if SDK not available
  if (Platform.OS === 'web' || !AppEventsLogger) {
    logger.info('Skipping AppLaunch event (web or SDK not available)', { feature: 'Facebook' });
    return;
  }

  try {
    // Add event ID for deduplication between client and server
    const eventParams: Record<string, string> = {
      _eventId: eventId
    };
    
    // Log the event - SDK will handle advertiserTrackingEnabled flag automatically
    AppEventsLogger.logEvent('fb_mobile_app_launch', eventParams);
    
    logger.info('AppLaunch event logged to Facebook', { feature: 'Facebook', eventId });
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
 * @param eventId - Event ID for deduplication between client and server
 * @param eventName - Name of the event (e.g., 'AppInstall', 'AppLaunch')
 * @param userData - User data for the event
 * @param customData - Custom event data
 * @param attributionData - Attribution data from deep link
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
 * INTERNAL USE ONLY - Use sendAppInstallEventDual() instead
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
  try {
    await sendConversionEvent(eventId, 'AppInstall', userData, undefined, attributionData);
    logger.info('AppInstall event sent successfully', { feature: 'Facebook', eventId });
  } catch (error) {
    logger.error('Error sending AppInstall event', { feature: 'Facebook', error });
    throw error;
  }
}

/**
 * Send AppLaunch event to Facebook (Server-Side via Cloud Function)
 * INTERNAL USE ONLY - Use sendAppLaunchEventDual() instead
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
  try {
    await sendConversionEvent(eventId, 'AppLaunch', userData, undefined, attributionData);
    logger.info('AppLaunch event sent successfully', { 
      feature: 'Facebook',
      eventId,
      hasUserData: !!userData,
      hasAttribution: !!attributionData
    });
  } catch (error) {
    logger.error('Error sending AppLaunch event', { feature: 'Facebook', error });
    throw error;
  }
}

/**
 * Send AppInstall event to both client and server with shared event ID for deduplication
 * This is the recommended way to send AppInstall events as it ensures proper deduplication
 */
export async function sendAppInstallEventDual(
  attributionData: AttributionData,
  userData?: {
    email?: string;
  }
): Promise<void> {
  // Generate single event ID for both client and server
  const eventId = generateEventId();
  
  logger.info('Sending AppInstall event (dual-send)', { 
    feature: 'Facebook', 
    eventId,
    hasUserData: !!userData,
    hasAttribution: !!attributionData
  });
  
  // Send to both client and server in parallel
  const results = await Promise.allSettled([
    logAppInstallEvent(attributionData, eventId),
    sendAppInstallEvent(eventId, userData, attributionData)
  ]);
  
  // Check results
  const clientResult = results[0];
  const serverResult = results[1];
  
  const clientSuccess = clientResult.status === 'fulfilled';
  const serverSuccess = serverResult.status === 'fulfilled';
  
  // Log individual results
  if (clientSuccess) {
    logger.info('AppInstall client-side event sent successfully', { feature: 'Facebook', eventId });
  } else {
    logger.warn('AppInstall client-side event failed', { 
      feature: 'Facebook', 
      eventId,
      error: clientResult.reason 
    });
  }
  
  if (serverSuccess) {
    logger.info('AppInstall server-side event sent successfully', { feature: 'Facebook', eventId });
  } else {
    logger.error('AppInstall server-side event failed', { 
      feature: 'Facebook', 
      eventId,
      error: serverResult.reason 
    });
  }
  
  // Throw error only if both failed
  if (!clientSuccess && !serverSuccess) {
    throw new Error('Both client and server AppInstall events failed');
  }
  
  // If only client failed but server succeeded, that's acceptable (server is more reliable)
  logger.info('AppInstall dual-send completed', { 
    feature: 'Facebook', 
    eventId,
    clientSuccess,
    serverSuccess
  });
}

/**
 * Send AppLaunch event to both client and server with shared event ID for deduplication
 * This is the recommended way to send AppLaunch events as it ensures proper deduplication
 */
export async function sendAppLaunchEventDual(
  attributionData?: AttributionData,
  userData?: {
    email?: string;
  }
): Promise<void> {
  // Generate single event ID for both client and server
  const eventId = generateEventId();
  
  logger.info('Sending AppLaunch event (dual-send)', { 
    feature: 'Facebook', 
    eventId,
    hasUserData: !!userData,
    hasAttribution: !!attributionData
  });
  
  // Send to both client and server in parallel
  const results = await Promise.allSettled([
    logAppLaunchEvent(eventId),
    sendAppLaunchEvent(eventId, userData, attributionData)
  ]);
  
  // Check results
  const clientResult = results[0];
  const serverResult = results[1];
  
  const clientSuccess = clientResult.status === 'fulfilled';
  const serverSuccess = serverResult.status === 'fulfilled';
  
  // Log individual results
  if (clientSuccess) {
    logger.info('AppLaunch client-side event sent successfully', { feature: 'Facebook', eventId });
  } else {
    logger.warn('AppLaunch client-side event failed', { 
      feature: 'Facebook', 
      eventId,
      error: clientResult.reason 
    });
  }
  
  if (serverSuccess) {
    logger.info('AppLaunch server-side event sent successfully', { feature: 'Facebook', eventId });
  } else {
    logger.error('AppLaunch server-side event failed', { 
      feature: 'Facebook', 
      eventId,
      error: serverResult.reason 
    });
  }
  
  // Throw error only if both failed
  if (!clientSuccess && !serverSuccess) {
    throw new Error('Both client and server AppLaunch events failed');
  }
  
  // If only client failed but server succeeded, that's acceptable (server is more reliable)
  logger.info('AppLaunch dual-send completed', { 
    feature: 'Facebook', 
    eventId,
    clientSuccess,
    serverSuccess
  });
}

/**
 * Send first launch events (App Install + App Launch)
 * Should be called only on first app launch with attribution data
 * Uses dual-send approach with proper event deduplication
 */
export async function sendFirstLaunchEvents(attributionData: AttributionData): Promise<void> {
  try {
    // Send App Install events (client + server with shared event ID)
    await sendAppInstallEventDual(
      attributionData,
      attributionData.email ? { email: attributionData.email } : undefined
    );
    logger.info('App Install events sent', { feature: 'Facebook' });
    
    // Send App Launch events immediately after (client + server with shared event ID)
    await sendAppLaunchEventDual(
      attributionData,
      attributionData.email ? { email: attributionData.email } : undefined
    );
    logger.info('App Launch events sent', { feature: 'Facebook' });
  } catch (error) {
    logger.error('Error sending first launch events', { feature: 'Facebook', error });
    throw error;
  }
}

