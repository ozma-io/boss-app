import { FACEBOOK_CONFIG } from '@/constants/facebook.config';
import { functions } from '@/constants/firebase.config';
import { logger } from '@/services/logger.service';
import { buildExtinfo, getAdvertiserTrackingEnabled, getApplicationTrackingEnabledSync } from '@/utils/deviceInfo';
import { validateFacebookEventTime } from '@/utils/facebookTimestamp';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import { AttributionData } from './attribution.service';

// Conditionally import Facebook SDK only on native platforms
// Using imported types when available to ensure type safety
import type { default as SettingsType } from 'react-native-fbsdk-next/lib/typescript/src/FBSettings';
import type { default as AppEventsLoggerType } from 'react-native-fbsdk-next/lib/typescript/src/FBAppEventsLogger';

let Settings: typeof SettingsType | undefined;
let AppEventsLogger: typeof AppEventsLoggerType | undefined;

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
  userId: string; // Firebase User ID - CRITICAL for external_id matching
  actionSource?: 'app' | 'website' | 'email' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'business_messaging' | 'other';
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
    externalId?: string; // Firebase User ID for cross-channel user matching
  };
  customData?: Record<string, string | number | boolean>;
}

// ============================================================================
// Facebook Standard Events
// ============================================================================

/**
 * Official Facebook mobile app events
 * 
 * NAMING IN SDK vs FACEBOOK:
 * - React Native SDK uses constants like AppEventsLogger.AppEvents.CompletedRegistration
 * - These map to actual event names sent to Facebook with 'fb_mobile_' prefix
 * - Example: AppEventsLogger.AppEvents.CompletedRegistration → fb_mobile_complete_registration
 * 
 * Available standard events from SDK (AppEventsLogger.AppEvents.*):
 * - AchievedLevel → fb_mobile_level_achieved
 * - AddedPaymentInfo → fb_mobile_add_payment_info
 * - AddedToCart → fb_mobile_add_to_cart
 * - AddedToWishlist → fb_mobile_add_to_wishlist
 * - CompletedRegistration → fb_mobile_complete_registration
 * - CompletedTutorial → fb_mobile_tutorial_completion
 * - InitiatedCheckout → fb_mobile_initiated_checkout
 * - Purchased → fb_mobile_purchase
 * - Rated → fb_mobile_rate
 * - Searched → fb_mobile_search
 * - SpentCredits → fb_mobile_spent_credits
 * - UnlockedAchievement → fb_mobile_achievement_unlocked
 * - ViewedContent → fb_mobile_content_view
 * - Contact → fb_mobile_contact
 * - CustomizeProduct → fb_mobile_customize_product
 * - Donate → fb_mobile_donate
 * - FindLocation → fb_mobile_find_location
 * - Schedule → fb_mobile_schedule
 * - StartTrial → fb_mobile_start_trial
 * - SubmitApplication → fb_mobile_submit_application
 * - Subscribe → fb_mobile_subscribe
 * - AdClick → fb_mobile_ad_click
 * - AdImpression → fb_mobile_ad_impression
 * 
 * IMPORTANT: Only official Facebook events should be added here.
 * Custom events are separate (see below).
 * 
 * Currently used standard events:
 * - fb_mobile_activate_app - App launch tracking (both first and subsequent launches)
 * - fb_mobile_complete_registration - User registration completion
 * - fb_mobile_achievement_unlocked - User achievements/milestones (e.g., first chat message)
 * 
 * Note: "Activate App" is the only standard event for tracking app opens.
 * There is NO separate "app launch" event in Facebook's official SDK.
 * The "Install" event is sent via Conversions API (server-side) only.
 * 
 * @see https://developers.facebook.com/docs/app-events/reference
 */
const FB_MOBILE_ACTIVATE_APP = 'fb_mobile_activate_app'; // Sent via AppEventsLogger with constants from native SDK
const FB_MOBILE_COMPLETE_REGISTRATION = 'fb_mobile_complete_registration'; // Sent via AppEventsLogger with constants from native SDK
const FB_MOBILE_ACHIEVEMENT_UNLOCKED = 'fb_mobile_achievement_unlocked'; // Sent via AppEventsLogger with constants from native SDK

/**
 * Custom Facebook events for specific user actions
 * 
 * CUSTOM vs STANDARD EVENTS:
 * - Standard events use predefined SDK constants (e.g., AppEventsLogger.AppEvents.CompletedRegistration)
 * - Custom events use plain string names without SDK constants
 * - Custom events are sent to Facebook with the exact string name you specify (no 'fb_mobile_' prefix)
 * - Custom events allow for separate campaign optimization goals
 * 
 * Currently used:
 * - SecondChatMessage - User sends their second message to AI assistant (sent as "SecondChatMessage" to Facebook)
 */
const CUSTOM_SECOND_CHAT_MESSAGE = 'SecondChatMessage';

// ============================================================================
// Facebook Standard Event Parameters
// ============================================================================

/**
 * Standard event parameters for Facebook App Events
 * 
 * NAMING IN SDK vs FACEBOOK:
 * - React Native SDK uses constants like AppEventsLogger.AppEventParams.RegistrationMethod
 * - For client-side events: Use snake_case parameter names (e.g., 'registration_method', 'fb_description')
 * - For server-side events: Use camelCase in customData (e.g., 'description', 'achievement_id')
 * 
 * Common standard parameters (AppEventsLogger.AppEventParams.*):
 * - RegistrationMethod → 'fb_registration_method' (client) or 'registration_method' (server)
 * - Description → 'fb_description' (client) or 'description' (server)
 * - ContentID → 'fb_content_id' (client) or 'content_id' (server)
 * - ContentType → 'fb_content_type' (client) or 'content_type' (server)
 * - Currency → 'fb_currency' (client) or 'currency' (server)
 * - Level → 'fb_level' (client) or 'level' (server)
 * - MaxRatingValue → 'fb_max_rating_value' (client) or 'max_rating_value' (server)
 * - NumItems → 'fb_num_items' (client) or 'num_items' (server)
 * - PaymentInfoAvailable → 'fb_payment_info_available' (client) or 'payment_info_available' (server)
 * - SearchString → 'fb_search_string' (client) or 'search_string' (server)
 * - Success → 'fb_success' (client) or 'success' (server)
 * 
 * Note: 
 * - Client-side parameters often use 'fb_' prefix when using raw strings
 * - Server-side parameters (via Conversions API) use plain names without 'fb_' prefix
 * - Special parameter '_eventId' is used for deduplication between client and server
 * 
 * @see https://developers.facebook.com/docs/app-events/reference
 */

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
    eventTime: validateFacebookEventTime(Math.floor(Date.now() / 1000), params.eventName),
    eventId: params.eventId,
    actionSource: params.actionSource || 'app',
    advertiserTrackingEnabled,
    applicationTrackingEnabled,
    extinfo,
    // Facebook Conversions API requires formatted cookies (NOT raw fbclid):
    // - fbc: "fb.1.timestamp.fbclid" (contains fbclid inside, used for attribution)
    // - fbp: "fb.1.timestamp.random" (browser identifier)
    // Raw fbclid is NOT accepted in user_data by Facebook - must be formatted as fbc
    fbc: params.attributionData?.fbc || undefined,
    fbp: params.attributionData?.fbp || undefined,
    userData: {
      ...params.userData,
      // Add Firebase User ID as external_id for cross-channel user matching
      // This is CRITICAL for Facebook to link all events from the same user
      // Skip if userId is empty (pre-login events like AppInstall before registration)
      ...(params.userId ? { externalId: params.userId } : {}),
    },
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
 * @param userId - Firebase User ID (used as external_id for user matching). Optional for pre-login events.
 * @param eventId - Event ID for deduplication between client and server
 * @param eventName - Name of the event (e.g., 'AppInstall', 'AppLaunch')
 * @param userData - User data for the event (will be hashed by Cloud Function)
 * @param customData - Custom event data (e.g., currency, value)
 * @param attributionData - Attribution data from deep link (fbclid, utm params)
 * @param actionSource - Event source (default: 'app'). Use 'website' for web-proxy events.
 */
export async function sendConversionEvent(
  userId: string | undefined,
  eventId: string,
  eventName: string,
  userData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  },
  customData?: Record<string, string | number | boolean>,
  attributionData?: AttributionData,
  actionSource?: 'app' | 'website' | 'email' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'business_messaging' | 'other'
): Promise<void> {
  // Log warning if userId is missing (pre-login events won't have external_id)
  if (!userId) {
    logger.warn('Sending conversion event without userId (external_id will be missing)', {
      feature: 'Facebook',
      eventName,
      eventId,
      hasEmail: !!userData?.email,
    });
  }
  try {
    // Build complete event data payload using helper
    // userId will be used as external_id if provided (important for user matching)
    const eventData = await buildEventData({
      userId: userId || '', // Empty string if no userId (pre-login events)
      eventId,
      eventName,
      actionSource,
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
 * @param userId - Firebase User ID (used as external_id for user matching). Optional for pre-login installs.
 * @param attributionData - Attribution data from deep link (fbclid, utm params, email)
 * @param userData - Optional user data (email) for server-side event
 */
export async function sendAppInstallEventDual(
  userId: string | undefined,
  attributionData: AttributionData,
  userData?: {
    email?: string;
  }
): Promise<void> {
  const eventId = generateEventId();
  
  logger.info('Sending AppInstall event (dual-send)', { 
    feature: 'Facebook', 
    eventId,
    userId,
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
      if (!isClientSdkAvailable()) {
        throw new Error('Facebook SDK not available on this platform');
      }
      AppEventsLogger!.logEvent(FB_MOBILE_ACTIVATE_APP, clientParams);
      logger.info('AppInstall client-side sent', { feature: 'Facebook', eventId });
    })(),
    
    // Server-side: Conversions API via Cloud Function (with external_id for user matching)
    sendConversionEvent(userId, eventId, FB_MOBILE_ACTIVATE_APP, userData, undefined, attributionData)
  ]);
  
  // Check results
  const [clientResult, serverResult] = results;
  const clientSuccess = clientResult.status === 'fulfilled';
  const serverSuccess = serverResult.status === 'fulfilled';
  
  // At least server event must succeed (client may be unavailable on web)
  if (!serverSuccess) {
    throw new Error('Server-side AppInstall event failed (client-only success is not sufficient)');
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
 * @param userId - Firebase User ID (used as external_id for user matching)
 * @param email - User email for Advanced Matching (will be hashed automatically)
 * @param attributionData - Optional attribution data from Firestore (fbclid, fbc, fbp from web-funnel)
 */
export async function sendRegistrationEventDual(userId: string, email: string, attributionData?: AttributionData): Promise<void> {
  const eventId = generateEventId();
  
  logger.info('Sending Registration event', { 
    feature: 'Facebook', 
    eventId,
    userId,
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
      if (!isClientSdkAvailable()) {
        throw new Error('Facebook SDK not available on this platform');
      }
      AppEventsLogger!.logEvent(FB_MOBILE_COMPLETE_REGISTRATION, clientParams);
      logger.info('Registration client-side sent', { feature: 'Facebook', eventId });
    })(),
    
    // Server-side: Conversions API with email + external_id + attribution (fbc, fbp, fbclid from Firestore)
    sendConversionEvent(userId, eventId, FB_MOBILE_COMPLETE_REGISTRATION, { email }, { registration_method: 'email' }, attributionData)
  ]);
  
  // Check results  
  const [clientResult, serverResult] = results;
  const clientSuccess = clientResult.status === 'fulfilled';
  const serverSuccess = serverResult.status === 'fulfilled';
  
  // At least server event must succeed (client may be unavailable on web or blocked by ATT)
  if (!serverSuccess) {
    throw new Error('Server-side Registration event failed (client-only success is not sufficient)');
  }
  
  logger.info('Registration dual-send completed', { 
    feature: 'Facebook', 
    eventId,
    clientSuccess,
    serverSuccess
  });
}

/**
 * Send first chat message event to Facebook for user engagement tracking
 * 
 * Sends fb_mobile_achievement_unlocked event when user sends their first message to AI assistant.
 * 
 * ⚠️ CRITICAL: Dual-send approach ensures reliable delivery:
 * - Client-side (iOS/Android SDK): May be blocked if ATT denied on iOS
 * - Server-side (Conversions API): ALWAYS sent regardless of ATT status!
 * 
 * Server-side event works even with ATT denied because:
 * 1. Sent from our server, not from user's device
 * 2. Contains userId (Firebase UID) as external_id for cross-channel matching
 * 3. Contains email (from Firebase Auth) for User Matching
 * 4. Contains fbc/fbp (from Firestore) for attribution
 * 5. Contains full device info (extinfo) for Device Matching
 * 6. Facebook accepts and processes server events with advertiserTrackingEnabled=0
 * 
 * This helps Facebook:
 * - Track meaningful user engagement beyond registration
 * - Optimize campaigns for users who actually use the core product feature
 * - Build Custom Audiences of engaged users
 * - Link all events from the same user (via external_id)
 * - Improve event matching with user email + external_id + attribution data
 * 
 * Event will appear in Events Manager as: "fb_mobile_achievement_unlocked" or "UnlockedAchievement"
 * 
 * @param userId - Firebase User ID (used as external_id for user matching)
 * @param email - User email for Advanced Matching (will be hashed automatically by Cloud Function)
 * @param attributionData - Optional attribution data from Firestore (fbclid, fbc, fbp from web-funnel)
 */
export async function sendFirstChatMessageEventDual(userId: string, email: string, attributionData?: AttributionData): Promise<void> {
  const eventId = generateEventId();
  
  logger.info('Sending FirstChatMessage event', { 
    feature: 'Facebook', 
    eventId,
    userId,
    hasEmail: !!email,
    hasAttributionData: !!attributionData,
    hasFbc: !!attributionData?.fbc,
    hasFbp: !!attributionData?.fbp
  });
  
  // Client params for Facebook SDK
  const clientParams: Record<string, string> = { 
    _eventId: eventId,
    fb_description: 'first_chat_message'
  };
  
  // Custom data for server-side event
  const customData: Record<string, string> = {
    description: 'first_chat_message',
    achievement_id: 'chat_first_message'
  };
  
  // Send to both client and server in parallel
  const results = await Promise.allSettled([
    // Client-side: Facebook SDK
    (async () => {
      if (!isClientSdkAvailable()) {
        throw new Error('Facebook SDK not available on this platform');
      }
      AppEventsLogger!.logEvent(FB_MOBILE_ACHIEVEMENT_UNLOCKED, clientParams);
      logger.info('FirstChatMessage client-side sent', { feature: 'Facebook', eventId });
    })(),
    
    // Server-side: Conversions API with external_id + email + attribution (fbc, fbp, fbclid from Firestore)
    sendConversionEvent(userId, eventId, FB_MOBILE_ACHIEVEMENT_UNLOCKED, { email }, customData, attributionData)
  ]);
  
  // Check results  
  const [clientResult, serverResult] = results;
  const clientSuccess = clientResult.status === 'fulfilled';
  const serverSuccess = serverResult.status === 'fulfilled';
  
  // At least server event must succeed (client may be unavailable on web or blocked by ATT)
  if (!serverSuccess) {
    throw new Error('Server-side FirstChatMessage event failed (client-only success is not sufficient)');
  }
  
  logger.info('FirstChatMessage dual-send completed', { 
    feature: 'Facebook', 
    eventId,
    clientSuccess,
    serverSuccess
  });
}

/**
 * Send second chat message event to Facebook for continued engagement tracking
 * 
 * Sends custom "SecondChatMessage" event when user sends their second message to AI assistant.
 * This is a CUSTOM event (not standard Facebook event) to allow separate campaign optimization.
 * 
 * ⚠️ TRIPLE-SEND APPROACH:
 * 1. Client-side (iOS/Android SDK): May be blocked if ATT denied on iOS
 * 2. Server-side as 'app' (Conversions API): ALWAYS sent regardless of ATT status
 * 3. Server-side as 'website' (Conversions API): Additional web-proxy event for web campaign optimization
 * 
 * ⚠️ IMPORTANT: The third event (AppWebProxySecondChatMessage with actionSource: 'website') 
 * is NOT recommended by Facebook as it misrepresents the actual event source.
 * Facebook's best practice is to always use the correct actionSource ('app' for mobile app events).
 * However, we intentionally use this approach to:
 * - Optimize web campaigns using mobile app conversion events
 * - Enable web-based campaign bidding strategies for app events
 * - Test different attribution models (app vs web)
 * 
 * This is a deliberate violation of Facebook's guidelines for business optimization purposes.
 * The event name prefix "AppWebProxy" makes it clear this is a proxy event, not a real web event.
 * 
 * The third event (AppWebProxySecondChatMessage) allows:
 * - Separate tracking for web-based campaign optimization
 * - Testing different attribution models (app vs web)
 * - Campaign optimization specifically for web conversions
 * 
 * Server-side events work even with ATT denied because:
 * 1. Sent from our server, not from user's device
 * 2. Contains userId (Firebase UID) as external_id for cross-channel matching
 * 3. Contains email (from Firebase Auth) for User Matching
 * 4. Contains fbc/fbp (from Firestore) for attribution
 * 5. Contains full device info (extinfo) for Device Matching
 * 6. Facebook accepts and processes server events with advertiserTrackingEnabled=0
 * 
 * This helps Facebook:
 * - Track continued engagement (beyond first message)
 * - Optimize campaigns specifically for users who send 2+ messages
 * - Build Custom Audiences of highly engaged users
 * - Allow separate campaign goals (first message vs. second message)
 * - Enable web-based campaign optimization using app events
 * 
 * Events will appear in Events Manager as:
 * - "SecondChatMessage" (custom event, actionSource: app)
 * - "AppWebProxySecondChatMessage" (custom event, actionSource: website)
 * 
 * @param userId - Firebase User ID (used as external_id for user matching)
 * @param email - User email for Advanced Matching (will be hashed automatically by Cloud Function)
 * @param attributionData - Optional attribution data from Firestore (fbclid, fbc, fbp from web-funnel)
 */
export async function sendSecondChatMessageEventDual(userId: string, email: string, attributionData?: AttributionData): Promise<void> {
  const eventId = generateEventId();
  const webProxyEventId = generateEventId(); // Separate event ID for web-proxy event
  
  logger.info('Sending SecondChatMessage event (triple-send)', { 
    feature: 'Facebook', 
    eventId,
    webProxyEventId,
    userId,
    hasEmail: !!email,
    hasAttributionData: !!attributionData,
    hasFbc: !!attributionData?.fbc,
    hasFbp: !!attributionData?.fbp
  });
  
  // Client params for Facebook SDK
  const clientParams: Record<string, string> = { 
    _eventId: eventId,
    fb_description: 'second_chat_message'
  };
  
  // Custom data for server-side event
  const customData: Record<string, string> = {
    description: 'second_chat_message',
    message_number: '2'
  };
  
  // Send to client and both servers in parallel
  const results = await Promise.allSettled([
    // Client-side: Facebook SDK with custom event name
    (async () => {
      if (!isClientSdkAvailable()) {
        throw new Error('Facebook SDK not available on this platform');
      }
      AppEventsLogger!.logEvent(CUSTOM_SECOND_CHAT_MESSAGE, clientParams);
      logger.info('SecondChatMessage client-side sent', { feature: 'Facebook', eventId });
    })(),
    
    // Server-side #1: Conversions API as 'app' source (standard dual-send)
    sendConversionEvent(userId, eventId, CUSTOM_SECOND_CHAT_MESSAGE, { email }, customData, attributionData, 'app'),
    
    // Server-side #2: Conversions API as 'website' source (web-proxy for campaign optimization)
    sendConversionEvent(userId, webProxyEventId, 'AppWebProxySecondChatMessage', { email }, customData, attributionData, 'website')
  ]);
  
  // Check results  
  const [clientResult, serverAppResult, serverWebResult] = results;
  const clientSuccess = clientResult.status === 'fulfilled';
  const serverAppSuccess = serverAppResult.status === 'fulfilled';
  const serverWebSuccess = serverWebResult.status === 'fulfilled';
  
  // At least one server event must succeed (client may be unavailable on web or blocked by ATT)
  if (!serverAppSuccess && !serverWebSuccess) {
    throw new Error('Both server-side SecondChatMessage events failed (client-only success is not sufficient)');
  }
  
  logger.info('SecondChatMessage triple-send completed', { 
    feature: 'Facebook', 
    eventId,
    webProxyEventId,
    clientSuccess,
    serverAppSuccess,
    serverWebSuccess
  });
}

