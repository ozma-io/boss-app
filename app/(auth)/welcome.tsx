import { AuthButton } from '@/components/auth/AuthButton';
import { EmailAuthModal } from '@/components/auth/EmailAuthModal';
import { AppColors } from '@/constants/Colors';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { signInWithApple, signInWithGoogle } from '@/services/auth.service';
import { openPrivacyPolicy, openTermsOfService } from '@/services/policy.service';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AuthButtonType = 'email' | 'google' | 'apple';

interface AuthButtonConfig {
  type: AuthButtonType;
  variant: 'primary' | 'secondary';
}

function getAuthButtonsConfig(): AuthButtonConfig[] {
  if (Platform.OS === 'web') {
    return [
      { type: 'email', variant: 'primary' },
      { type: 'apple', variant: 'secondary' },
      { type: 'google', variant: 'secondary' },
    ];
  }
  
  if (Platform.OS === 'ios') {
    return [
      { type: 'apple', variant: 'primary' },
      { type: 'google', variant: 'secondary' },
      { type: 'email', variant: 'secondary' },
    ];
  }
  
  // Android
  return [
    { type: 'google', variant: 'primary' },
    { type: 'email', variant: 'secondary' },
    { type: 'apple', variant: 'secondary' },
  ];
}

export default function WelcomeScreen(): React.JSX.Element {
  const [isEmailModalVisible, setIsEmailModalVisible] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('welcome_screen_viewed');
    }, [])
  );

  const handleEmailSignIn = (): void => {
    trackAmplitudeEvent('auth_signin_clicked', {
      method: 'email',
      screen: 'welcome',
    });
    setIsEmailModalVisible(true);
  };

  // TODO: Test Google Sign-In flow thoroughly before production release
  const handleGoogleSignIn = async (): Promise<void> => {
    trackAmplitudeEvent('auth_signin_clicked', {
      method: 'google',
      screen: 'welcome',
    });
    
    try {
      await signInWithGoogle();
    } catch (error) {
      trackAmplitudeEvent('auth_signin_failed', {
        method: 'google',
        error_type: error instanceof Error ? error.message : 'unknown',
      });
      Alert.alert('Error', 'Google Sign-In failed. Please try again.');
    }
  };

  const handleAppleSignIn = async (): Promise<void> => {
    trackAmplitudeEvent('auth_signin_clicked', {
      method: 'apple',
      screen: 'welcome',
    });
    
    try {
      await signInWithApple();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown';
      
      trackAmplitudeEvent('auth_signin_failed', {
        method: 'apple',
        error_type: errorMessage,
      });
      
      // Check if user explicitly cancelled (they pressed Cancel button)
      const isUserCancelled = 
        errorMessage.toLowerCase().includes('cancel') ||
        errorMessage.includes('1001'); // Explicit cancellation code
      
      if (isUserCancelled) {
        // Silent fail - user knows they cancelled
        return;
      }
      
      // For system errors (not signed in to iCloud, etc.)
      // Show friendly message AFTER Apple's system dialog closed
      const isSystemAuthError = 
        errorMessage.includes('7022') || // AKAuthenticationError
        errorMessage.includes('1000') || // AuthorizationError (generic)
        errorMessage.includes('unknown reason');
      
      if (isSystemAuthError) {
        Alert.alert(
          'Apple ID Required', 
          'Please sign in to your Apple ID in Settings to use Sign in with Apple.',
          [{ text: 'OK' }]
        );
      } else {
        // Unexpected technical error
        Alert.alert(
          'Something went wrong',
          'Apple Sign-In failed. Please try again.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  return (
    <View style={styles.container} testID="welcome-container">
      <View style={styles.emojiContainer} testID="emoji-container">
        <Image
          source={require('@/assets/images/emoji-faces.png')}
          style={styles.emojiImage}
          resizeMode="contain"
          testID="emoji-image"
        />
      </View>

      <View style={styles.titleContainer} testID="title-container">
        <Text style={styles.title} testID="title-text">Microsteps</Text>
        <Text style={styles.subtitle} testID="subtitle-text">as a Path to Growth</Text>
        <Text style={styles.description} testID="description-text">
          Your AI Assistant tells you exactly{'\n'}what to do next
        </Text>
      </View>

      <View style={styles.buttonContainer} testID="button-container">
        {getAuthButtonsConfig().map((buttonConfig) => {
          const handlePress = 
            buttonConfig.type === 'email' ? handleEmailSignIn :
            buttonConfig.type === 'google' ? handleGoogleSignIn :
            handleAppleSignIn;
          
          return (
            <AuthButton
              key={buttonConfig.type}
              type={buttonConfig.type}
              variant={buttonConfig.variant}
              onPress={handlePress}
              testID={`auth-button-${buttonConfig.type}`}
            />
          );
        })}
      </View>

      <View style={styles.footer} testID="welcome-footer">
        <TouchableOpacity onPress={openPrivacyPolicy} testID="privacy-policy-button">
          <Text style={styles.footerLink} testID="privacy-policy-text">Privacy policy</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openTermsOfService} testID="terms-of-service-button">
          <Text style={styles.footerLink} testID="terms-of-service-text">Terms of service</Text>
        </TouchableOpacity>
      </View>

      <EmailAuthModal
        isVisible={isEmailModalVisible}
        onClose={() => setIsEmailModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    paddingTop: 60,
    paddingBottom: 40,
  },
  emojiContainer: {
    width: '100%',
    aspectRatio: 1572 / 869,
    marginBottom: 30,
  },
  emojiImage: {
    width: '100%',
    height: '100%',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 40,
    color: '#000',
    marginBottom: 0,
    fontFamily: 'Lobster-Regular',
  },
  subtitle: {
    fontSize: 40,
    color: '#000',
    marginBottom: 20,
    fontFamily: 'Lobster-Regular',
  },
  description: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'Manrope-Regular',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginTop: 'auto',
    paddingHorizontal: 24,
  },
  footerLink: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'Manrope-Regular',
  },
});

