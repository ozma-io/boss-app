import { useAuth } from '@/contexts/AuthContext';
import { recordTrackingPromptShown, requestTrackingPermission, updateTrackingPermissionStatus } from '@/services/tracking.service';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TrackingOnboardingScreen(): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      // If user is logged in, record that we showed the prompt
      if (user) {
        await recordTrackingPromptShown(user.id);
      }
      
      // Request system ATT permission
      const status = await requestTrackingPermission();
      
      // If user is logged in, update their tracking permission status
      if (user) {
        await updateTrackingPermissionStatus(user.id, status);
      }
      
      // Navigate back to app flow
      router.replace('/(tabs)');
    } catch (error) {
      console.error('[TrackingOnboarding] Error handling tracking permission:', error);
      router.replace('/(tabs)');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container} testID="tracking-onboarding-container">
      <View style={styles.content} testID="tracking-onboarding-content">
        <View style={styles.iconContainer} testID="tracking-icon-container">
          <FontAwesome name="bullseye" size={64} color="#FF9500" testID="tracking-icon" />
        </View>

        <Text style={styles.title} testID="tracking-title">Help us improve your experience</Text>
        
        <Text style={styles.description} testID="tracking-description">
          We'd like to send data about your app installation to Meta so they can recommend our app to people who will find it most useful.
        </Text>

        <View style={styles.benefitsContainer} testID="benefits-container">
          <View style={styles.benefitCard} testID="benefit-card-1">
            <View style={styles.benefitIconContainer} testID="benefit-icon-container-1">
              <FontAwesome name="check-circle" size={24} color="#4CAF50" testID="benefit-icon-1" />
            </View>
            <View style={styles.benefitTextContainer}>
              <Text style={styles.benefitTitle} testID="benefit-title-1">Better recommendations</Text>
              <Text style={styles.benefitDescription} testID="benefit-description-1">
                Help Meta recommend our app to users who need it the most
              </Text>
            </View>
          </View>

          <View style={styles.benefitCard} testID="benefit-card-2">
            <View style={styles.benefitIconContainer} testID="benefit-icon-container-2">
              <FontAwesome name="check-circle" size={24} color="#4CAF50" testID="benefit-icon-2" />
            </View>
            <View style={styles.benefitTextContainer}>
              <Text style={styles.benefitTitle} testID="benefit-title-2">Support the app</Text>
              <Text style={styles.benefitDescription} testID="benefit-description-2">
                Help us grow and continue providing this app to more people
              </Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.continueButton} 
        onPress={handleContinue}
        disabled={isLoading}
        testID="tracking-continue-button"
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" testID="tracking-loading-indicator" />
        ) : (
          <Text style={styles.continueButtonText} testID="tracking-continue-text">Continue</Text>
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
  benefitsContainer: {
    width: '100%',
    gap: 16,
  },
  benefitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  benefitIconContainer: {
    marginRight: 16,
  },
  benefitTextContainer: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    fontFamily: 'Manrope-SemiBold',
  },
  benefitDescription: {
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
