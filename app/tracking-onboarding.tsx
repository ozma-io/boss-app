import { useAuth } from '@/contexts/AuthContext';
import { useTrackingOnboarding } from '@/contexts/TrackingOnboardingContext';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { getAttributionDataWithFallback, isAppInstallEventSent, markAppInstallEventSent } from '@/services/attribution.service';
import { sendAppInstallEventDual, sendRegistrationEventDual } from '@/services/facebook.service';
import { logger } from '@/services/logger.service';
import { getUserProfile, markFirstAppLogin } from '@/services/user.service';
import { LoginMethod } from '@/types';
import { recordTrackingPromptShown, requestTrackingPermission, updateTrackingPermissionStatus } from '@/services/tracking.service';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TrackingOnboardingScreen(): React.JSX.Element {
  const router = useRouter();
  const { user, authState } = useAuth();
  const { setShouldShowOnboarding } = useTrackingOnboarding();
  const [isLoading, setIsLoading] = useState(false);
  
  // Get params from route (passed from handlePostLoginTracking)
  const params = useLocalSearchParams();
  const emailParam = typeof params.email === 'string' ? params.email : undefined;
  const methodParam = typeof params.method === 'string' ? params.method as LoginMethod : undefined;
  const isFirstLogin = params.isFirstLogin === 'true';

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('tracking_onboarding_screen_viewed', {
        is_first_login: isFirstLogin
      });
    }, [isFirstLogin])
  );

  const handleContinue = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      // If user is logged in, record that we showed the prompt
      if (user) {
        await recordTrackingPromptShown(user.id);
      }
      
      // Request system ATT permission
      const status = await requestTrackingPermission();
      logger.info('ATT permission status received', { feature: 'TrackingOnboarding', status });
      
      // On iOS: Update Facebook SDK advertiser tracking setting after ATT permission
      // Note: SDK is already initialized automatically (isAutoInitEnabled: true)
      if (Platform.OS === 'ios' && status === 'authorized') {
        try {
          const { Settings } = require('react-native-fbsdk-next');
          await Settings.setAdvertiserTrackingEnabled(true);
          logger.info('Advertiser tracking enabled in Facebook SDK after ATT permission', { feature: 'TrackingOnboarding' });
        } catch (error) {
          logger.warn('Failed to enable advertiser tracking', { feature: 'TrackingOnboarding', error });
        }
      }
      
      // If user is logged in, update their tracking permission status
      if (user) {
        await updateTrackingPermissionStatus(user.id, status);
      }
      
      // ============================================================
      // TRACKING FLOW: Send App Install + Registration events on first app login
      // ============================================================
      
      // isFirstLogin flag comes from route params (set in handlePostLoginTracking)
      // However, we must verify against Firestore to prevent duplicate events if app crashed
      if (user && isFirstLogin === true) {
        try {
          // CRITICAL: Check actual Firestore state to prevent duplicate events
          // Route params persist across app crashes, but Firestore is the source of truth
          const userProfile = await getUserProfile(user.id);
          
          if (userProfile?.firstAppLoginAt) {
            logger.info('First app login already marked in Firestore, skipping Facebook events', {
              feature: 'TrackingOnboarding',
              userId: user.id,
              firstAppLoginAt: userProfile.firstAppLoginAt
            });
            
            // Skip event sending - this is not actually the first login
            // (app crashed after marking but before completing events)
          } else {
            // This is truly the first app login - proceed with events
            // Get email and method from route params
            const email = emailParam;
            const method = methodParam;
            
            logger.info('First app login confirmed (Firestore check passed), sending Facebook events', {
              feature: 'TrackingOnboarding',
              hasEmail: !!email,
              hasMethod: !!method,
              userId: user.id
            });
          
          if (email && method) {
            // Get attribution data with AsyncStorage + Firestore fallback
            const attributionData = await getAttributionDataWithFallback(user.id);
            
            // Check if App Install event was already sent (Scenario A at app launch)
            // If not, send it now (Scenario B - after login with userId + email)
            const isInstallEventSent = await isAppInstallEventSent();
            
            if (!isInstallEventSent) {
              logger.info('App Install event not sent yet, sending now with userId + email', {
                feature: 'TrackingOnboarding',
                userId: user.id,
                hasAttributionData: !!attributionData,
              });
              
              // Send App Install event with userId + email + attribution
              await sendAppInstallEventDual(
                user.id,
                attributionData || {},
                { email }
              );
              
              // Mark as sent (non-critical operation - don't block Registration event if this fails)
              try {
                await markAppInstallEventSent();
              } catch (markError) {
                logger.error('Failed to mark app install event as sent (non-critical, continuing)', {
                  feature: 'TrackingOnboarding',
                  userId: user.id,
                  error: markError
                });
                // Don't throw - Registration event must still be sent
              }
              
              logger.info('App Install event sent successfully', {
                feature: 'TrackingOnboarding',
                userId: user.id,
                hasAttributionData: !!attributionData,
              });
            } else {
              logger.debug('App Install event already sent, skipping', {
                feature: 'TrackingOnboarding',
                userId: user.id,
              });
            }
            
            // ALWAYS send Registration event for Custom Audiences and Lookalike targeting
            // Attribution data is optional - Facebook will use email + userId for Custom Audiences
            // even without fbc/fbp/fbclid
            await sendRegistrationEventDual(user.id, email, method, attributionData || undefined);
            
            logger.info('Registration event sent successfully', {
              feature: 'TrackingOnboarding',
              userId: user.id,
              hasAttributionData: !!attributionData,
              hasFbc: !!attributionData?.fbc,
              hasFbp: !!attributionData?.fbp,
              source: attributionData ? (attributionData.fbc || attributionData.fbp ? 'asyncstorage_or_firestore' : 'asyncstorage') : 'none'
            });
            
            // Mark first app login in Firestore (AFTER successful event sending)
            // This ensures firstAppLoginAt is only set after events are sent successfully
            // preventing duplicate events if app crashes before completion
            // Includes 5 retry attempts with exponential backoff (same as Android flow)
            try {
              await markFirstAppLogin(user.id);
              logger.info('Marked first app login after successful event sending', {
                feature: 'TrackingOnboarding',
                userId: user.id
              });
            } catch (markError) {
              logger.error('Failed to mark first app login after retries', { 
                feature: 'TrackingOnboarding', 
                userId: user.id, 
                error: markError 
              });
              // Don't throw - this shouldn't block user flow
            }
          } else {
            logger.info('No email or method available, skipping Facebook events', { 
              feature: 'TrackingOnboarding',
              hasEmail: !!email,
              hasMethod: !!method
            });
          }
        }
        } catch (fbError) {
          logger.error('Failed to send Facebook events', { feature: 'TrackingOnboarding', error: fbError instanceof Error ? fbError : new Error(String(fbError)) });
          // Don't block user flow on FB error
        }
      } else if (user) {
        logger.debug('Not first app login, skipping Facebook events', {
          feature: 'TrackingOnboarding',
          userId: user.id,
          isFirstLogin
        });
      }
      
      // Mark tracking onboarding as completed
      setShouldShowOnboarding(false);
      
      // Navigate to appropriate screen based on auth state
      if (authState === 'authenticated') {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/welcome');
      }
    } catch (error) {
      logger.error('Failed to handle tracking permission', { feature: 'TrackingOnboarding', error: error instanceof Error ? error : new Error(String(error)) });
      setShouldShowOnboarding(false);
      
      // Navigate to appropriate screen even on error
      if (authState === 'authenticated') {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/welcome');
      }
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
