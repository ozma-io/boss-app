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
import { logger } from './logger';

// Define the secret parameter
const facebookAccessToken = defineSecret('FACEBOOK_ACCESS_TOKEN');

interface FacebookConversionEventData {
  eventName: string;
  eventTime: number;
  eventId: string;
  advertiserTrackingEnabled: boolean;
  applicationTrackingEnabled: boolean;
  // Extended device info (REQUIRED): 16-element array
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
  extinfo: string[];
  fbclid?: string;
  userData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
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

    if (eventData.advertiserTrackingEnabled === undefined || eventData.applicationTrackingEnabled === undefined) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: advertiserTrackingEnabled and applicationTrackingEnabled'
      );
    }

    if (!eventData.extinfo || eventData.extinfo.length !== 16) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required field: extinfo must be an array of 16 strings. See Facebook Conversions API documentation for details. Required: extinfo[0] (version: i2/a2) and extinfo[4] (OS version) cannot be empty!'
      );
    }

    try {
      // Prepare user data with hashing
      const userData: Record<string, string> = {};
      if (eventData.userData?.email) {
        userData.em = hashData(eventData.userData.email);
      }
      if (eventData.userData?.phone) {
        userData.ph = hashData(eventData.userData.phone);
      }
      if (eventData.userData?.firstName) {
        userData.fn = hashData(eventData.userData.firstName);
      }
      if (eventData.userData?.lastName) {
        userData.ln = hashData(eventData.userData.lastName);
      }
      if (eventData.userData?.city) {
        userData.ct = hashData(eventData.userData.city);
      }
      if (eventData.userData?.state) {
        userData.st = hashData(eventData.userData.state);
      }
      if (eventData.userData?.zip) {
        userData.zp = hashData(eventData.userData.zip);
      }
      if (eventData.userData?.country) {
        userData.country = hashData(eventData.userData.country);
      }

      // Build event payload
      const eventPayload = {
        event_name: eventData.eventName,
        event_time: eventData.eventTime,
        event_id: eventData.eventId,
        user_data: userData,
        custom_data: eventData.customData || {},
        action_source: 'app',
        app_data: {
          advertiser_tracking_enabled: eventData.advertiserTrackingEnabled ? 1 : 0,
          application_tracking_enabled: eventData.applicationTrackingEnabled ? 1 : 0,
          extinfo: eventData.extinfo,
        },
      };

      // Add fbclid if present (for attribution)
      if (eventData.fbclid) {
        (eventPayload as any).fbp = eventData.fbclid;
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
        hasUserData: Object.keys(userData).length > 0,
        hasFbclid: !!eventData.fbclid,
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

