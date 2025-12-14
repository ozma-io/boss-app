/**
 * Facebook Conversions API Integration
 * 
 * This module handles server-side event tracking to Facebook via the Conversions API.
 * It supports sending various events (AppInstall, Purchase, etc.) with proper deduplication.
 */

import * as crypto from 'crypto';
import * as functions from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onCall } from 'firebase-functions/v2/https';
import { FACEBOOK_API_VERSION, FACEBOOK_PIXEL_ID } from './constants';
import { validateFacebookEventTime } from './facebookTimestamp';
import { logger } from './logger';

// Define the secret parameter
const facebookAccessToken = defineSecret('FACEBOOK_ACCESS_TOKEN');

/**
 * Facebook Conversions API action source types
 * 
 * ⚠️ DUPLICATE TYPE: This type is duplicated in services/facebook.service.ts
 * Both definitions MUST be kept in sync manually.
 * Cannot import from client code because Cloud Functions is a separate project.
 * 
 * Indicates where the conversion event occurred.
 * @see https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event#action-source
 * @see services/facebook.service.ts - Original definition (exported as FacebookActionSource)
 */
type FacebookActionSource = 
  | 'app'                    // Mobile app or desktop app
  | 'website'                // Website
  | 'email'                  // Email
  | 'phone_call'             // Phone call
  | 'chat'                   // Chat (e.g., Messenger, WhatsApp)
  | 'physical_store'         // Physical store
  | 'system_generated'       // System generated (e.g., server-side logic)
  | 'business_messaging'     // Business messaging
  | 'other';                 // Other

interface FacebookConversionEventData {
  eventName: string;
  eventTime: number;
  eventId: string;
  actionSource: FacebookActionSource;
  advertiserTrackingEnabled?: boolean; // Required only for action_source === 'app'
  applicationTrackingEnabled?: boolean; // Required only for action_source === 'app'
  // Extended device info (REQUIRED for action_source === 'app'): 16-element array
  // [0] extinfo version (REQUIRED: "i2" for iOS, "a2" for Android)
  // [1] app package name
  // [2] short version
  // [3] long version
  // [4] OS version (REQUIRED)
  // [5] device model name
  // [6] locale
  // [7] timezone abbreviation
  // [8] carrier
  // [9] screen width
  // [10] screen height
  // [11] screen density
  // [12] CPU cores
  // [13] external storage size in GB
  // [14] free space on external storage in GB
  // [15] device timezone
  // Example iOS: ["i2", "com.ozmaio.bossup", "1.0", "1.0 (1)", "17.0.0", "iPhone14,3", "en_US", "PST", "AT&T", "390", "844", "3", "6", "128", "64", "America/New_York"]
  // Example Android: ["a2", "com.ozmaio.bossup", "1.0", "1.0 (1)", "14", "Pixel 7 Pro", "en_US", "PST", "Verizon", "1080", "2340", "3", "8", "128", "64", "America/New_York"]
  extinfo?: string[]; // Required only for action_source === 'app'
  // Facebook attribution cookies (formatted, NOT raw fbclid):
  // - fbc: Facebook Click Cookie (format: "fb.1.timestamp.fbclid") - for ad attribution
  // - fbp: Facebook Browser ID (format: "fb.1.timestamp.random") - for user matching
  // Note: Raw fbclid is NOT accepted by Conversions API - it must be formatted as fbc cookie
  fbc?: string;
  fbp?: string;
  userData?: {
    email?: string;
    // External ID - user's unique identifier in your system (Firebase UID)
    // CRITICAL for User Matching and cross-channel attribution
    // Sent in raw form (not hashed) - Firebase UID is already random and non-sensitive
    externalId?: string;
  };
  customData?: Record<string, string | number | boolean>;
}

/**
 * Hash data using SHA-256 (required by Facebook for PII)
 */
function hashData(data: string): string {
  if (!data) {
    return '';
  }
  return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

/**
 * Send conversion event to Facebook Conversions API
 * 
 * This is a callable Cloud Function that accepts event data from the client
 * and forwards it to Facebook's Conversions API with proper formatting.
 */
export const sendFacebookConversionEvent = onCall(
  {
    region: 'us-central1',
    invoker: 'public', // Allow unauthenticated access for AppInstall events
    secrets: [facebookAccessToken], // Declare the secret
  },
  async (request) => {
    const eventData = request.data as FacebookConversionEventData;

    // Get configuration (secrets from env, public constants from code)
    const pixelId = FACEBOOK_PIXEL_ID;
    const accessToken = facebookAccessToken.value().trim();
    const apiVersion = FACEBOOK_API_VERSION;

    if (!pixelId || !accessToken) {
      logger.error('Facebook missing configuration', {
        hasPixelId: !!pixelId,
        hasAccessToken: !!accessToken,
      });
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Facebook API not configured'
      );
    }

    // Validate required fields
    if (!eventData.eventName || !eventData.eventTime || !eventData.eventId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: eventName, eventTime, or eventId'
      );
    }

    if (!eventData.actionSource) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required field: actionSource'
      );
    }

    // Validate app-specific fields only for 'app' action_source
    if (eventData.actionSource === 'app') {
      if (eventData.advertiserTrackingEnabled === undefined || eventData.applicationTrackingEnabled === undefined) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required fields for app events: advertiserTrackingEnabled and applicationTrackingEnabled'
        );
      }

      if (!eventData.extinfo || eventData.extinfo.length !== 16) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required field for app events: extinfo must be an array of 16 strings. See Facebook Conversions API documentation for details. Required: extinfo[0] (version: i2/a2) and extinfo[4] (OS version) cannot be empty!'
        );
      }
    }

    try {
      // Prepare user data with hashing
      const userData: Record<string, string> = {};
      
      // Email - hashed for privacy (PII)
      if (eventData.userData?.email) {
        userData.em = hashData(eventData.userData.email);
      }

      // External ID (Firebase User ID) - CRITICAL for User Matching
      // Send in raw form (not hashed) - it's already a random Firebase UID, not sensitive
      // This helps Facebook:
      // 1. Link all events from the same user across sessions/devices
      // 2. Match events between web-funnel and mobile app
      // 3. Build better Custom Audiences
      // 4. Improve Event Match Quality
      if (eventData.userData?.externalId) {
        userData.external_id = eventData.userData.externalId;
      }

      // Facebook tracking cookies - NOT hashed, passed as-is for attribution
      if (eventData.fbc) {
        userData.fbc = eventData.fbc;
      }
      if (eventData.fbp) {
        userData.fbp = eventData.fbp;
      }

      // Event name validation: We expect Facebook standard events
      // Common mobile app events: fb_mobile_activate_app, fb_mobile_purchase, 
      // fb_mobile_complete_registration, fb_mobile_add_to_cart, etc.
      // See: https://developers.facebook.com/docs/app-events/reference
      logger.info('Facebook processing event', {
        eventName: eventData.eventName,
        isStandardMobileEvent: eventData.eventName.startsWith('fb_mobile_'),
      });

      // Build event payload
      // Validate timestamp from client to ensure it meets Facebook requirements
      const eventPayload: Record<string, any> = {
        event_name: eventData.eventName,
        event_time: validateFacebookEventTime(eventData.eventTime, eventData.eventName),
        event_id: eventData.eventId,
        user_data: userData,
        custom_data: eventData.customData || {},
        action_source: eventData.actionSource,
      };

      // Add app_data ONLY for mobile app events (action_source === 'app')
      // For web-proxy events (action_source === 'website'), we omit app_data to better mimic real website events
      if (eventData.actionSource === 'app') {
        eventPayload.app_data = {
          advertiser_tracking_enabled: eventData.advertiserTrackingEnabled ? 1 : 0,
          application_tracking_enabled: eventData.applicationTrackingEnabled ? 1 : 0,
          extinfo: eventData.extinfo,
        };
      }

      // Prepare the request to Facebook Conversions API
      const url = `https://graph.facebook.com/${apiVersion}/${pixelId}/events`;
      const payload = {
        data: [eventPayload],
        access_token: accessToken,
      };

      logger.info('Facebook sending conversion event', {
        eventName: eventData.eventName,
        eventId: eventData.eventId,
        actionSource: eventData.actionSource,
        hasUserData: Object.keys(userData).length > 0,
        hasFbc: !!eventData.fbc,
        hasFbp: !!eventData.fbp,
      });

      // Send request to Facebook
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        logger.error('Facebook Conversions API error', { responseData });
        throw new functions.https.HttpsError(
          'internal',
          'Failed to send event to Facebook'
        );
      }

      logger.info('Facebook conversion event sent successfully', { responseData });

      return {
        success: true,
        eventsReceived: responseData.events_received || 0,
        fbtrace_id: responseData.fbtrace_id,
      };
    } catch (error) {
      logger.error('Facebook error sending conversion event', { error });
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        'Failed to send conversion event'
      );
    }
  }
);

