import { Platform } from 'react-native';

let amplitude: any = null;
let SessionReplayPlugin: any = null;
let webAmplitude: any = null;
let isInitialized = false;

// For native platforms (iOS/Android)
if (Platform.OS !== 'web') {
  try {
    amplitude = require('@amplitude/analytics-react-native');
    const sessionReplayModule = require('@amplitude/plugin-session-replay-react-native');
    SessionReplayPlugin = sessionReplayModule.SessionReplayPlugin;
  } catch (error) {
    console.warn('[Amplitude] Native SDK packages not available:', error);
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
      console.log('[Amplitude] Initializing Web SDK with Session Replay...');
      
      // Check if the script is loaded
      if (typeof window !== 'undefined' && (window as any).amplitude) {
        webAmplitude = (window as any).amplitude;
        
        // Initialize with full config
        // Session Replay is already included in the CDN script
        webAmplitude.init('2ec3617e5449dbc96f374776115b3594', {
          fetchRemoteConfig: true,
          serverZone: 'EU',
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

      console.log('[Amplitude] Initializing Native SDK with Session Replay...');
      
      // Initialize Amplitude with API key and server zone
      await amplitude.init(
        '2ec3617e5449dbc96f374776115b3594',
        undefined,
        { serverZone: 'EU' }
      ).promise;
      
      // Add Session Replay plugin
      await amplitude.add(new SessionReplayPlugin()).promise;
      
      isInitialized = true;
      console.log('[Amplitude] Native SDK initialized successfully with Session Replay');
    }
  } catch (error) {
    console.error('[Amplitude] Failed to initialize:', error);
    // Don't throw - allow app to continue without Amplitude
  }
}

/**
 * Set user ID for Amplitude tracking
 * Call this after user authentication
 */
export async function setAmplitudeUserId(userId: string): Promise<void> {
  if (!isInitialized) {
    console.warn('[Amplitude] SDK not initialized, cannot set user ID');
    return;
  }

  try {
    if (Platform.OS === 'web') {
      if (webAmplitude) {
        webAmplitude.setUserId(userId);
        console.log('[Amplitude] User ID set (web):', userId);
      }
    } else {
      if (amplitude) {
        await amplitude.setUserId(userId).promise;
        console.log('[Amplitude] User ID set (native):', userId);
      }
    }
  } catch (error) {
    console.error('[Amplitude] Failed to set user ID:', error);
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
    console.warn('[Amplitude] SDK not initialized, cannot track event');
    return;
  }

  try {
    if (Platform.OS === 'web') {
      if (webAmplitude) {
        webAmplitude.track(eventName, eventProperties);
        console.log('[Amplitude] Event tracked (web):', eventName, eventProperties || {});
      }
    } else {
      if (amplitude) {
        amplitude.track(eventName, eventProperties);
        console.log('[Amplitude] Event tracked (native):', eventName, eventProperties || {});
      }
    }
  } catch (error) {
    console.error('[Amplitude] Failed to track event:', error);
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
        await amplitude.reset().promise;
        console.log('[Amplitude] User session reset (native)');
      }
    }
  } catch (error) {
    console.error('[Amplitude] Failed to reset user:', error);
  }
}

