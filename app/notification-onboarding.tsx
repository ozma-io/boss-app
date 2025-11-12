import { useAuth } from '@/contexts/AuthContext';
import { useNotificationOnboarding } from '@/contexts/NotificationOnboardingContext';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { requestNotificationPermissions } from '@/services/notification.service';
import { recordNotificationPromptShown, updateNotificationPermissionStatus } from '@/services/user.service';
import { logger } from '@/services/logger.service';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function NotificationOnboardingScreen(): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const { setShouldShowOnboarding } = useNotificationOnboarding();
  const [isLoading, setIsLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('notification_onboarding_screen_viewed');
    }, [])
  );

  const handleContinue = async (): Promise<void> => {
    if (!user) {
      return;
    }

    try {
      setIsLoading(true);
      
      await recordNotificationPromptShown(user.id);
      
      const status = await requestNotificationPermissions();
      
      await updateNotificationPermissionStatus(user.id, status);
      
      setShouldShowOnboarding(false);
      
      router.replace('/(tabs)');
    } catch (error) {
      logger.error('Failed to handle notification permission', error instanceof Error ? error : new Error(String(error)), { feature: 'NotificationOnboarding' });
      setShouldShowOnboarding(false);
      router.replace('/(tabs)');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container} testID="notification-onboarding-container">
      <View style={styles.content} testID="notification-onboarding-content">
        <View style={styles.iconContainer} testID="notification-icon-container">
          <FontAwesome name="bell" size={64} color="#FF9500" testID="notification-bell-icon" />
        </View>

        <Text style={styles.title} testID="notification-title">Get notified</Text>
        
        <Text style={styles.description} testID="notification-description">
          Once every 3 days the app will send you push notifications with tips
        </Text>

        <View style={styles.examplesContainer} testID="examples-container">
          <View style={styles.notificationCard} testID="notification-card-1">
            <View style={styles.notificationHeader} testID="notification-header-1">
              <View style={styles.appIconContainer} testID="app-icon-container-1">
                <FontAwesome name="briefcase" size={16} color="#8BC34A" testID="app-icon-1" />
              </View>
              <Text style={styles.appName} testID="app-name-1">THE BOSS APP</Text>
              <Text style={styles.timestamp} testID="timestamp-1">now</Text>
            </View>
            <Text style={styles.notificationTitle} testID="notification-title-1">Time to make yourself visible 👀</Text>
            <Text style={styles.notificationBody} testID="notification-body-1">
              haven't shared an update in a while? drop a quick one-liner in your team channel — a small win or progress note. visibility is also a skill 💪
            </Text>
          </View>

          <View style={styles.notificationCard} testID="notification-card-2">
            <View style={styles.notificationHeader} testID="notification-header-2">
              <View style={styles.appIconContainer} testID="app-icon-container-2">
                <FontAwesome name="briefcase" size={16} color="#8BC34A" testID="app-icon-2" />
              </View>
              <Text style={styles.appName} testID="app-name-2">THE BOSS APP</Text>
              <Text style={styles.timestamp} testID="timestamp-2">3 days ago</Text>
            </View>
            <Text style={styles.notificationTitle} testID="notification-title-2">Collect your weekly win 🌱</Text>
            <Text style={styles.notificationBody} testID="notification-body-2">
              what's one thing you're proud of this week? write it down — even small wins compound into big growth
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.continueButton} 
        onPress={handleContinue}
        disabled={isLoading}
        testID="notification-continue-button"
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" testID="notification-loading-indicator" />
        ) : (
          <Text style={styles.continueButtonText} testID="notification-continue-text">Continue</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F1E8',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Manrope-Bold',
  },
  description: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
    fontFamily: 'Manrope-Regular',
  },
  examplesContainer: {
    width: '100%',
    gap: 16,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  appIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  appName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    flex: 1,
    fontFamily: 'Manrope-SemiBold',
  },
  timestamp: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'Manrope-Regular',
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    fontFamily: 'Manrope-SemiBold',
  },
  notificationBody: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    fontFamily: 'Manrope-Regular',
  },
  continueButton: {
    backgroundColor: '#000000',
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'Manrope-SemiBold',
  },
});

