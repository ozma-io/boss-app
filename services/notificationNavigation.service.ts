import { router } from 'expo-router';
import { Platform } from 'react-native';
import { logger } from './logger.service';

/**
 * Service for handling notification navigation using React Native Firebase
 * 
 * Provides reliable navigation from notifications by using Firebase messaging
 * instead of expo-notifications (which has data payload issues on iOS).
 */

/**
 * Navigate to chat screen with authentication check
 * 
 * @param authState - Current authentication state
 * @param setRedirectPath - Function to set redirect path for after auth
 * @param context - Additional context for logging
 */
function navigateToChat(
  authState: string,
  setRedirectPath: (path: string) => void,
  context: Record<string, any> = {}
): void {
  logger.info('Navigating to chat from notification', {
    feature: 'NotificationNavigation',
    authState,
    ...context,
  });

  if (authState === 'authenticated') {
    router.push('/chat');
  } else {
    logger.debug('User not authenticated, setting redirect path', {
      feature: 'NotificationNavigation',
      authState,
    });
    setRedirectPath('/chat');
  }
}

/**
 * Handle notification data and navigate appropriately
 * 
 * @param data - Notification data payload
 * @param authState - Current authentication state
 * @param setRedirectPath - Function to set redirect path for after auth
 * @param source - Source of notification (for logging)
 */
export function handleNotificationNavigation(
  data: Record<string, any> | null | undefined,
  authState: string,
  setRedirectPath: (path: string) => void,
  source: 'background' | 'quit' = 'background'
): void {
  try {
    // Log navigation attempt
    logger.debug('Handling notification navigation', {
      feature: 'NotificationNavigation',
      data,
      authState,
      source,
    });

    // Check notification type
    if (data?.type === 'chat_message') {
      navigateToChat(authState, setRedirectPath, {
        threadId: data.threadId,
        messageId: data.messageId,
        source,
      });
    } else {
      // Unknown notification type - use chat fallback
      logger.warn('Unknown notification type, using chat fallback', {
        feature: 'NotificationNavigation',
        data,
        notificationType: data?.type || null,
        source,
      });

      // Send warning to Sentry but continue with fallback
      const { captureException } = require('@sentry/react-native');
      captureException(new Error(`Unknown notification type - using chat fallback (${source})`), {
        tags: {
          feature: 'NotificationNavigation',
          platform: Platform.OS,
          notification_type: data?.type || 'unknown',
          source,
        },
        extra: {
          data,
          authState,
          timestamp: new Date().toISOString(),
        },
      });

      navigateToChat(authState, setRedirectPath, {
        source,
        fallbackUsed: true,
      });
    }
  } catch (error) {
    logger.error('Error in notification navigation handler', {
      feature: 'NotificationNavigation',
      error,
      data,
      authState,
      source,
    });

    // Still try to navigate to chat as fallback
    navigateToChat(authState, setRedirectPath, {
      source,
      error: true,
    });
  }
}

/**
 * Setup React Native Firebase notification handlers
 * 
 * @param authState - Current authentication state
 * @param setRedirectPath - Function to set redirect path
 * @returns Array of cleanup functions
 */
export function setupFirebaseNotificationHandlers(
  authState: string,
  setRedirectPath: (path: string) => void
): (() => void)[] {
  if (Platform.OS === 'web') {
    return [];
  }

  const cleanupFunctions: (() => void)[] = [];

  try {
    // Dynamic import to avoid issues with web platform
    const messaging = require('@react-native-firebase/messaging').default;

    // Handle notification opened app from background state
    const unsubscribeBackground = messaging().onNotificationOpenedApp((remoteMessage: any) => {
      logger.info('Notification opened app from background', {
        feature: 'NotificationNavigation',
        data: remoteMessage.data,
        notification: remoteMessage.notification,
      });

      handleNotificationNavigation(remoteMessage.data, authState, setRedirectPath, 'background');
    });
    
    cleanupFunctions.push(unsubscribeBackground);

    // Handle initial notification (app was quit)
    messaging()
      .getInitialNotification()
      .then((remoteMessage: any) => {
        if (remoteMessage) {
          logger.info('App opened from notification (quit state)', {
            feature: 'NotificationNavigation',
            data: remoteMessage.data,
            notification: remoteMessage.notification,
          });

          handleNotificationNavigation(remoteMessage.data, authState, setRedirectPath, 'quit');
        }
      })
      .catch((error: Error) => {
        logger.error('Error checking initial notification', {
          feature: 'NotificationNavigation',
          error,
        });
      });

  } catch (error) {
    logger.error('Error setting up Firebase notification handlers', {
      feature: 'NotificationNavigation',
      error,
    });
  }

  return cleanupFunctions;
}
