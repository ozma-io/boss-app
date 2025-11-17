/**
 * NOTE: We intentionally do NOT use logger.service in this file to avoid circular dependency.
 * 
 * Circular dependency issue:
 * - amplitude.service imports logger.service
 * - logger.service imports amplitude.service (to track error_logged events)
 * - This creates a require cycle
 * 
 * Solution: Use console.log/warn/error directly in this file.
 * The logger.service will still send error_logged events to Amplitude for business errors.
 */

import { AMPLITUDE_API_KEY } from '@/constants/amplitude.config';
import { Platform } from 'react-native';

let amplitude: any = null;
let SessionReplayPlugin: any = null;
let webAmplitude: any = null;
let isInitialized = false;

// Event queue for events tracked before SDK initialization
type QueuedEvent = {
  type: 'event';
  eventName: string;
  eventProperties?: Record<string, any>;
} | {
  type: 'setUserId';
  userId: string;
  email: string;
} | {
  type: 'setUserProperties';
  properties: Record<string, any>;
};

let eventQueue: QueuedEvent[] = [];

// For native platforms (iOS/Android)
if (Platform.OS !== 'web') {
  try {
    amplitude = require('@amplitude/analytics-react-native');
    const sessionReplayModule = require('@amplitude/plugin-session-replay-react-native');
    SessionReplayPlugin = sessionReplayModule.SessionReplayPlugin;
  } catch (error) {
    console.warn('[Amplitude] Native SDK packages not available', error);
  }
}

/**
 * Initialize Amplitude SDK with Session Replay
 * Should be called once at app startup
 * Works on iOS, Android, and Web
 */
export async function initializeAmplitude(): Promise<void> {
  if (isInitialized) {
    console.log('[Amplitude] Already initialized, skipping');
    return;
  }

  try {
    if (Platform.OS === 'web') {
      // Web platform: use browser SDK
      console.log('[Amplitude] Initializing Web SDK with Session Replay');
      
      // Check if the script is loaded
      if (typeof window !== 'undefined' && (window as any).amplitude) {
        webAmplitude = (window as any).amplitude;
        
        // Add Session Replay plugin BEFORE init (as per official docs)
        if ((window as any).sessionReplay && (window as any).sessionReplay.plugin) {
          const sessionReplayPlugin = (window as any).sessionReplay.plugin({
            sampleRate: 1 // Record 100% of sessions
          });
          webAmplitude.add(sessionReplayPlugin);
          console.log('[Amplitude] Session Replay plugin added for web');
        } else {
          console.warn('[Amplitude] Session Replay plugin not found in window object');
        }
        
        // Initialize with full config (no serverZone for US - it's default)
        webAmplitude.init(AMPLITUDE_API_KEY, {
          fetchRemoteConfig: true,
          autocapture: {
            attribution: true,
            fileDownloads: true,
            formInteractions: true,
            pageViews: true,
            sessions: true,
            elementInteractions: true,
            networkTracking: true,
            webVitals: true,
            frustrationInteractions: true
          }
        });
        
        isInitialized = true;
        console.log('[Amplitude] Web SDK initialized successfully with Session Replay');
      } else {
        console.warn('[Amplitude] Web SDK script not loaded. Add script tag to index.html');
      }
    } else {
      // Native platform: use React Native SDK
      if (!amplitude || !SessionReplayPlugin) {
        console.warn('[Amplitude] Native SDK not available, skipping initialization');
        return;
      }

      console.log('[Amplitude] Initializing Native SDK with Session Replay');
      
      // Initialize Amplitude with API key (userId is undefined, config is 3rd param)
      await amplitude.init(AMPLITUDE_API_KEY, undefined, {
        disableCookies: true,
      });
      
      // Add Session Replay plugin
      await amplitude.add(new SessionReplayPlugin({
        sampleRate: 1 // Record 100% of sessions (consistent with web config)
      }));
      
      isInitialized = true;
      console.log('[Amplitude] Native SDK initialized successfully with Session Replay');
    }

    // Flush queued events after successful initialization
    if (isInitialized && eventQueue.length > 0) {
      console.log(`[Amplitude] Flushing ${eventQueue.length} queued items`);
      const queueToFlush = [...eventQueue];
      eventQueue = []; // Clear queue immediately to prevent infinite loops
      
      for (const item of queueToFlush) {
        if (item.type === 'setUserId') {
          await setAmplitudeUserId(item.userId, item.email);
        } else if (item.type === 'setUserProperties') {
          await setAmplitudeUserProperties(item.properties);
        } else if (item.type === 'event') {
          trackAmplitudeEvent(item.eventName, item.eventProperties);
        }
      }
      
      console.log('[Amplitude] Queue flushed successfully');
    }
  } catch (error) {
    console.error('[Amplitude] Failed to initialize', error);
    // Don't throw - allow app to continue without Amplitude
  }
}

/**
 * Set user ID for Amplitude tracking
 * Call this after user authentication
 * 
 * @param userId - User ID to set
 * @param email - User email to set as user property (sets '[no_email]' placeholder if empty)
 */
export async function setAmplitudeUserId(userId: string, email: string): Promise<void> {
  if (!isInitialized) {
    console.log('[Amplitude] SDK not initialized, queuing setUserId');
    eventQueue.push({ type: 'setUserId', userId, email });
    return;
  }

  try {
    const emailValue = email && email.trim() !== '' ? email : '[no_email]';
    
    if (Platform.OS === 'web') {
      if (webAmplitude) {
        webAmplitude.setUserId(userId);
        
        const identifyObj = new webAmplitude.Identify();
        identifyObj.set('email', emailValue);
        webAmplitude.identify(identifyObj);
        console.log('[Amplitude] User ID and email set (web)', { userId, email: emailValue });
      }
    } else {
      if (amplitude) {
        await amplitude.setUserId(userId);
        
        const identifyObj = new amplitude.Identify();
        identifyObj.set('email', emailValue);
        await amplitude.identify(identifyObj);
        console.log('[Amplitude] User ID and email set (native)', { userId, email: emailValue });
      }
    }
  } catch (error) {
    console.error('[Amplitude] Failed to set user ID', error);
  }
}

/**
 * Set user properties in Amplitude
 * Call this to update user attributes for analytics
 * 
 * @param properties - Key-value pairs of user properties to set
 */
export async function setAmplitudeUserProperties(
  properties: Record<string, any>
): Promise<void> {
  if (!isInitialized) {
    console.log('[Amplitude] SDK not initialized, queuing setUserProperties');
    eventQueue.push({ type: 'setUserProperties', properties });
    return;
  }

  try {
    if (Platform.OS === 'web') {
      if (webAmplitude) {
        const identifyObj = new webAmplitude.Identify();
        Object.entries(properties).forEach(([key, value]) => {
          identifyObj.set(key, value);
        });
        webAmplitude.identify(identifyObj);
        console.log('[Amplitude] User properties set (web)', properties);
      }
    } else {
      if (amplitude) {
        const identifyObj = new amplitude.Identify();
        Object.entries(properties).forEach(([key, value]) => {
          identifyObj.set(key, value);
        });
        await amplitude.identify(identifyObj);
        console.log('[Amplitude] User properties set (native)', properties);
      }
    }
  } catch (error) {
    console.error('[Amplitude] Failed to set user properties', error);
  }
}

/**
 * Track an event with optional properties
 * 
 * @param eventName - Name of the event to track
 * @param eventProperties - Optional properties to attach to the event
 */
export function trackAmplitudeEvent(
  eventName: string,
  eventProperties?: Record<string, any>
): void {
  if (!isInitialized) {
    console.log('[Amplitude] SDK not initialized, queuing event', eventName);
    eventQueue.push({ type: 'event', eventName, eventProperties });
    return;
  }

  try {
    if (Platform.OS === 'web') {
      if (webAmplitude) {
        webAmplitude.track(eventName, eventProperties);
        console.log('[Amplitude] Event tracked (web)', eventName, eventProperties || {});
      }
    } else {
      if (amplitude) {
        amplitude.track(eventName, eventProperties);
        console.log('[Amplitude] Event tracked (native)', eventName, eventProperties || {});
      }
    }
  } catch (error) {
    console.error('[Amplitude] Failed to track event', error);
  }
}

/**
 * Reset user session and clear user ID
 * Call this when user signs out
 */
export async function resetAmplitudeUser(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  try {
    if (Platform.OS === 'web') {
      if (webAmplitude) {
        webAmplitude.reset();
        console.log('[Amplitude] User session reset (web)');
      }
    } else {
      if (amplitude) {
        await amplitude.reset();
        console.log('[Amplitude] User session reset (native)');
      }
    }
  } catch (error) {
    console.error('[Amplitude] Failed to reset user', error);
  }
}

