import { logger } from '@/services/logger.service';
import { setupFirebaseNotificationHandlers } from '@/services/notificationNavigation.service';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// Only import on native platforms
let Notifications: any = null;
if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
}

/**
 * Hook for setting up notification handlers and management
 * 
 * Combines:
 * - setNotificationHandler for controlling FCM display behavior
 * - React Native Firebase handlers for reliable navigation
 * - FCM foreground message handling with presence check
 */
export function useNotificationHandlers(
  segments: readonly string[],
  authState: string,
  setRedirectPath: (path: string) => void
): void {
  // Setup notification display handler (controls whether FCM shows in foreground)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    Notifications.setNotificationHandler({
      handleNotification: async () => {
        const isInChat = segments[0] === 'chat';
        
        logger.debug('Notification handler called', { 
          feature: 'NotificationHandlers',
          isInChat,
          currentRoute: segments[0],
        });

        return {
          shouldShowAlert: !isInChat,
          shouldPlaySound: !isInChat,
          shouldSetBadge: true, // Always update badge count
          shouldShowBanner: !isInChat,
          shouldShowList: !isInChat,
        };
      },
    });
  }, [segments]);

  // Setup FCM foreground message handler (for logging and presence check)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const setupForegroundHandler = async () => {
      try {
        const messagingModule = require('@react-native-firebase/messaging/lib/modular');
        const { getMessaging, onMessage } = messagingModule;
        const messaging = getMessaging();

        const unsubscribe = onMessage(messaging, async (remoteMessage: any) => {
          logger.info('FCM message received in foreground', { 
            feature: 'NotificationHandlers',
            title: remoteMessage.notification?.title,
            currentRoute: segments[0],
            data: remoteMessage.data,
          });

          // Log to Sentry breadcrumbs for debugging
          const { addBreadcrumb } = require('@sentry/react-native');
          addBreadcrumb({
            message: 'FCM message received in foreground',
            level: 'info',
            category: 'fcm',
            data: {
              title: remoteMessage.notification?.title,
              currentRoute: segments[0],
              data: remoteMessage.data,
              notification: remoteMessage.notification,
              timestamp: new Date().toISOString(),
            },
          });

          // Don't show additional notification if user is in chat
          // setNotificationHandler already controls the display
          if (segments[0] === 'chat') {
            logger.info('User is in chat screen, FCM handled by setNotificationHandler', { 
              feature: 'NotificationHandlers' 
            });
          } else {
            logger.info('User not in chat, FCM shown by setNotificationHandler', { 
              feature: 'NotificationHandlers',
              currentRoute: segments[0],
            });
          }
        });

        return unsubscribe;
      } catch (error) {
        logger.error('Error setting up foreground FCM handler', {
          feature: 'NotificationHandlers',
          error,
        });
        return () => {};
      }
    };

    const unsubscribePromise = setupForegroundHandler();

    return () => {
      unsubscribePromise.then((unsubscribe) => {
        if (unsubscribe) {
          unsubscribe();
        }
      });
    };
  }, [segments]);

  // Setup React Native Firebase notification navigation handlers
  useEffect(() => {
    const cleanupFunctions = setupFirebaseNotificationHandlers(authState, setRedirectPath);

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [authState, setRedirectPath]);
}
