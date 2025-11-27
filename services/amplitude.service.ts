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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let amplitude: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let webAmplitude: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SessionReplayPlugin: any = null;
let isInitialized = false;

// Event queue for events tracked before SDK initialization
type QueuedEvent = {
  type: 'event';
  eventName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventProperties?: Record<string, any>;
} | {
  type: 'setUserId';
  userId: string;
} | {
  type: 'setUserProperties';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Record<string, any>;
};

let eventQueue: QueuedEvent[] = [];

// For native platforms (iOS/Android)
if (Platform.OS !== 'web') {
  try {
    amplitude = require('@amplitude/analytics-react-native');
    SessionReplayPlugin = require('@amplitude/plugin-session-replay-react-native').SessionReplayPlugin;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof window !== 'undefined' && (window as any).amplitude) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        webAmplitude = (window as any).amplitude;
        
        // Add Session Replay plugin BEFORE init (as per official docs)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).sessionReplay && (window as any).sessionReplay.plugin) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sessionReplayPlugin = (window as any).sessionReplay.plugin({
            sampleRate: 1 // Record 100% of sessions
          });
          webAmplitude.add(sessionReplayPlugin);
          console.log('[Amplitude] Session Replay plugin added for web');
        } else {
          console.warn('[Amplitude] Session Replay plugin not found in window object');
        }
        
        // Initialize with full config (no serverZone for US - it's default)
        // Note: networkTracking disabled due to unhandled promise rejections causing app crashes
        try {
          webAmplitude.init(AMPLITUDE_API_KEY, {
            fetchRemoteConfig: true,
            autocapture: {
              attribution: true,
              fileDownloads: true,
              formInteractions: true,
              pageViews: true,
              sessions: true,
              elementInteractions: true,
              networkTracking: false,
              webVitals: true,
              frustrationInteractions: true
            }
          });
          
          isInitialized = true;
          console.log('[Amplitude] Web SDK initialized successfully with Session Replay');
        } catch (initError) {
          console.error('[Amplitude] Failed to initialize web SDK', initError);
          throw initError;
        }
      } else {
        console.warn('[Amplitude] Web SDK script not loaded. Add script tag to index.html');
      }
    } else {
      // Native platform: use React Native SDK
      if (!amplitude) {
        console.warn('[Amplitude] Native SDK not available, skipping initialization');
        return;
      }

      console.log('[Amplitude] Initializing Native SDK with Session Replay');
      
      // Initialize Amplitude with API key (userId is undefined, config is 3rd param)
      await amplitude.init(AMPLITUDE_API_KEY, undefined, {
        disableCookies: true,
        defaultTracking: true,
      }).promise;
      
      // Add Session Replay plugin AFTER init (modern approach as per official docs)
      if (SessionReplayPlugin) {
        const sessionReplayConfig = {
          enableRemoteConfig: true, // default: true
          sampleRate: 1,            // Record 100% of sessions (consistent with web config)
          autoStart: true,          // default: true
        };
        
        await amplitude.add(new SessionReplayPlugin(sessionReplayConfig)).promise;
        console.log('[Amplitude] Session Replay plugin added for native');
      } else {
        console.warn('[Amplitude] SessionReplayPlugin not available');
      }
      
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
          await setAmplitudeUserId(item.userId);
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
 */
export async function setAmplitudeUserId(userId: string): Promise<void> {
  if (!isInitialized) {
    console.log('[Amplitude] SDK not initialized, queuing setUserId');
    eventQueue.push({ type: 'setUserId', userId });
    return;
  }

  try {
    if (Platform.OS === 'web') {
      if (webAmplitude) {
        webAmplitude.setUserId(userId);
        console.log('[Amplitude] User ID set (web)', { userId });
      }
    } else {
      if (amplitude) {
        await amplitude.setUserId(userId);
        console.log('[Amplitude] User ID set (native)', { userId });
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        
        // Reset initialization flag for web so SDK can be re-initialized on next login
        // This ensures proper session handling when different users log in on the same device
        isInitialized = false;
        console.log('[Amplitude] Initialization flag reset - ready for next user');
      }
    } else {
      if (amplitude) {
        await amplitude.reset();
        console.log('[Amplitude] User session reset (native)');
        // Note: Native SDK stays initialized - reset() is sufficient for proper session handling
      }
    }
  } catch (error) {
    console.error('[Amplitude] Failed to reset user', error);
  }
}

