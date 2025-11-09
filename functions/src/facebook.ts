/**
 * Facebook Conversions API Integration
 * 
 * This module handles server-side event tracking to Facebook via the Conversions API.
 * It supports sending various events (AppInstall, Purchase, etc.) with proper deduplication.
 */

import * as crypto from 'crypto';
import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';
import { FACEBOOK_API_VERSION, FACEBOOK_PIXEL_ID } from './constants';

interface FacebookConversionEventData {
  eventName: string;
  eventTime: number;
  eventId: string;
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
  },
  async (request) => {
    const eventData = request.data as FacebookConversionEventData;

    // Get configuration (secrets from env, public constants from code)
    const pixelId = FACEBOOK_PIXEL_ID;
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    const apiVersion = FACEBOOK_API_VERSION;

    if (!pixelId || !accessToken) {
      console.error('[Facebook] Missing configuration: FACEBOOK_PIXEL_ID or FACEBOOK_ACCESS_TOKEN');
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

      console.log('[Facebook] Sending conversion event:', {
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
        console.error('[Facebook] Error from Conversions API:', responseData);
        throw new functions.https.HttpsError(
          'internal',
          'Failed to send event to Facebook'
        );
      }

      console.log('[Facebook] Conversion event sent successfully:', responseData);

      return {
        success: true,
        eventsReceived: responseData.events_received || 0,
        fbtrace_id: responseData.fbtrace_id,
      };
    } catch (error) {
      console.error('[Facebook] Error sending conversion event:', error);
      
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

