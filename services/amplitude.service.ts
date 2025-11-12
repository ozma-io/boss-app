import { AMPLITUDE_API_KEY } from '@/constants/amplitude.config';
import { logger } from '@/services/logger.service';
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
    logger.warn('Native SDK packages not available', { feature: 'Amplitude', error });
  }
}

/**
 * Initialize Amplitude SDK with Session Replay
 * Should be called once at app startup
 * Works on iOS, Android, and Web
 */
export async function initializeAmplitude(): Promise<void> {
  if (isInitialized) {
    logger.info('Already initialized, skipping', { feature: 'Amplitude' });
    return;
  }

  try {
    if (Platform.OS === 'web') {
      // Web platform: use browser SDK
      logger.info('Initializing Web SDK with Session Replay', { feature: 'Amplitude' });
      
      // Check if the script is loaded
      if (typeof window !== 'undefined' && (window as any).amplitude) {
        webAmplitude = (window as any).amplitude;
        
        // Add Session Replay plugin BEFORE init (as per official docs)
        if ((window as any).sessionReplay && (window as any).sessionReplay.plugin) {
          const sessionReplayPlugin = (window as any).sessionReplay.plugin({
            sampleRate: 1 // Record 100% of sessions
          });
          webAmplitude.add(sessionReplayPlugin);
          logger.info('Session Replay plugin added for web', { feature: 'Amplitude' });
        } else {
          logger.warn('Session Replay plugin not found in window object', { feature: 'Amplitude' });
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
        logger.info('Web SDK initialized successfully with Session Replay', { feature: 'Amplitude' });
      } else {
        logger.warn('Web SDK script not loaded. Add script tag to index.html', { feature: 'Amplitude' });
      }
    } else {
      // Native platform: use React Native SDK
      if (!amplitude || !SessionReplayPlugin) {
        logger.warn('Native SDK not available, skipping initialization', { feature: 'Amplitude' });
        return;
      }

      logger.info('Initializing Native SDK with Session Replay', { feature: 'Amplitude' });
      
      // Initialize Amplitude with API key (userId is undefined, config is 3rd param)
      await amplitude.init(AMPLITUDE_API_KEY, undefined, {
        disableCookies: true,
      });
      
      // Add Session Replay plugin
      await amplitude.add(new SessionReplayPlugin());
      
      isInitialized = true;
      logger.info('Native SDK initialized successfully with Session Replay', { feature: 'Amplitude' });
    }

    // Flush queued events after successful initialization
    if (isInitialized && eventQueue.length > 0) {
      logger.info(`Flushing ${eventQueue.length} queued items`, { feature: 'Amplitude' });
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
      
      logger.info('Queue flushed successfully', { feature: 'Amplitude' });
    }
  } catch (error) {
    logger.error('Failed to initialize', { feature: 'Amplitude', error });
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
    logger.info('SDK not initialized, queuing setUserId', { feature: 'Amplitude' });
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
        logger.info('User ID and email set (web)', { feature: 'Amplitude', userId, email: emailValue });
      }
    } else {
      if (amplitude) {
        await amplitude.setUserId(userId);
        
        const identifyObj = new amplitude.Identify();
        identifyObj.set('email', emailValue);
        await amplitude.identify(identifyObj);
        logger.info('User ID and email set (native)', { feature: 'Amplitude', userId, email: emailValue });
      }
    }
  } catch (error) {
    logger.error('Failed to set user ID', { feature: 'Amplitude', error });
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
    logger.info('SDK not initialized, queuing setUserProperties', { feature: 'Amplitude' });
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
        logger.info('User properties set (web)', { feature: 'Amplitude', properties });
      }
    } else {
      if (amplitude) {
        const identifyObj = new amplitude.Identify();
        Object.entries(properties).forEach(([key, value]) => {
          identifyObj.set(key, value);
        });
        await amplitude.identify(identifyObj);
        logger.info('User properties set (native)', { feature: 'Amplitude', properties });
      }
    }
  } catch (error) {
    logger.error('Failed to set user properties', { feature: 'Amplitude', error });
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
    logger.info('SDK not initialized, queuing event', { feature: 'Amplitude', eventName });
    eventQueue.push({ type: 'event', eventName, eventProperties });
    return;
  }

  try {
    if (Platform.OS === 'web') {
      if (webAmplitude) {
        webAmplitude.track(eventName, eventProperties);
        logger.info('Event tracked (web)', { feature: 'Amplitude', eventName, eventProperties: eventProperties || {} });
      }
    } else {
      if (amplitude) {
        amplitude.track(eventName, eventProperties);
        logger.info('Event tracked (native)', { feature: 'Amplitude', eventName, eventProperties: eventProperties || {} });
      }
    }
  } catch (error) {
    logger.error('Failed to track event', { feature: 'Amplitude', error });
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
        logger.info('User session reset (web)', { feature: 'Amplitude' });
      }
    } else {
      if (amplitude) {
        await amplitude.reset();
        logger.info('User session reset (native)', { feature: 'Amplitude' });
      }
    }
  } catch (error) {
    logger.error('Failed to reset user', { feature: 'Amplitude', error });
  }
}

