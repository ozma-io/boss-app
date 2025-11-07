import { AuthButton } from '@/components/auth/AuthButton';
import { AppColors } from '@/constants/Colors';
import { signInWithApple } from '@/services/auth.service';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WelcomeScreen(): React.JSX.Element {
  const router = useRouter();

  const handleEmailSignIn = (): void => {
    router.push('/(auth)/email-input');
  };

  const handleGoogleSignIn = async (): Promise<void> => {
    Alert.alert('Coming Soon', 'Google Sign-In will be implemented in the next iteration');
  };

  const handleAppleSignIn = async (): Promise<void> => {
    try {
      await signInWithApple();
    } catch (error) {
      Alert.alert('Error', 'Apple Sign-In failed. Please try again.');
    }
  };

  return (
    <View style={styles.container} testID="welcome-container">
      <View style={styles.emojiContainer} testID="emoji-container">
        <Image
          source={require('@/assets/images/emoji-faces.png')}
          style={styles.emojiImage}
          resizeMode="cover"
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
        <AuthButton type="email" onPress={handleEmailSignIn} testID="auth-button-email" />
        <AuthButton type="google" onPress={handleGoogleSignIn} testID="auth-button-google" />
        <AuthButton type="apple" onPress={handleAppleSignIn} testID="auth-button-apple" />
      </View>

      <View style={styles.footer} testID="welcome-footer">
        <TouchableOpacity onPress={() => Alert.alert('Privacy Policy')} testID="privacy-policy-button">
          <Text style={styles.footerLink} testID="privacy-policy-text">Privacy policy</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Terms of Service')} testID="terms-of-service-button">
          <Text style={styles.footerLink} testID="terms-of-service-text">Terms of service</Text>
        </TouchableOpacity>
      </View>
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
    height: 200,
    width: '100%',
    marginBottom: 30,
    marginHorizontal: 0,
    paddingHorizontal: 0,
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
  },
});

