import { useAuth } from '@/contexts/AuthContext';
import { useNotificationOnboarding } from '@/contexts/NotificationOnboardingContext';
import { requestNotificationPermissions } from '@/services/notification.service';
import { recordNotificationPromptShown, updateNotificationPermissionStatus } from '@/services/user.service';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function NotificationOnboardingScreen(): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const { setShouldShowOnboarding } = useNotificationOnboarding();
  const [isLoading, setIsLoading] = useState(false);

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
      console.error('Error handling notification permission:', error);
      setShouldShowOnboarding(false);
      router.replace('/(tabs)');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <FontAwesome name="bell" size={64} color="#FF9500" />
        </View>

        <Text style={styles.title}>Get notified</Text>
        
        <Text style={styles.description}>
          Once every 3 days the app will send you push notifications with tips
        </Text>

        <View style={styles.examplesContainer}>
          <View style={styles.notificationCard}>
            <View style={styles.notificationHeader}>
              <View style={styles.appIconContainer}>
                <FontAwesome name="briefcase" size={16} color="#8BC34A" />
              </View>
              <Text style={styles.appName}>THE BOSS APP</Text>
              <Text style={styles.timestamp}>now</Text>
            </View>
            <Text style={styles.notificationTitle}>Time to make yourself visible 👀</Text>
            <Text style={styles.notificationBody}>
              haven't shared an update in a while? drop a quick one-liner in your team channel — a small win or progress note. visibility is also a skill 💪
            </Text>
          </View>

          <View style={styles.notificationCard}>
            <View style={styles.notificationHeader}>
              <View style={styles.appIconContainer}>
                <FontAwesome name="briefcase" size={16} color="#8BC34A" />
              </View>
              <Text style={styles.appName}>THE BOSS APP</Text>
              <Text style={styles.timestamp}>3 days ago</Text>
            </View>
            <Text style={styles.notificationTitle}>Collect your weekly win 🌱</Text>
            <Text style={styles.notificationBody}>
              what's one thing you're proud of this week? write it down — even small wins compound into big growth
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.continueButton} 
        onPress={handleContinue}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.continueButtonText}>Continue</Text>
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
  },
  description: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  examplesContainer: {
    width: '100%',
    gap: 16,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
  },
  timestamp: {
    fontSize: 12,
    color: '#999999',
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
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
  },
});

