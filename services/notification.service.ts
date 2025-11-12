import { NotificationPermissionStatus } from '@/types';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logger } from '@/services/logger.service';

export async function requestNotificationPermissions(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'ios') {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    if (existingStatus === 'granted') {
      return 'granted';
    }

    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (status === 'granted') {
      return 'granted';
    } else if (status === 'denied') {
      return 'denied';
    } else {
      return 'denied';
    }
  } else if (Platform.OS === 'android') {
    // TODO: Android implementation
    // For now, return placeholder
    logger.info('Android notification permissions - placeholder implementation', { feature: 'Notification' });
    return 'not_asked';
  }

  return 'not_asked';
}

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'ios') {
    const { status } = await Notifications.getPermissionsAsync();
    
    if (status === 'granted') {
      return 'granted';
    } else if (status === 'denied') {
      return 'denied';
    } else {
      return 'not_asked';
    }
  } else if (Platform.OS === 'android') {
    // TODO: Android implementation
    logger.info('Android get notification permission status - placeholder implementation', { feature: 'Notification' });
    return 'not_asked';
  }

  return 'not_asked';
}

