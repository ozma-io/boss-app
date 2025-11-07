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
    <View style={styles.container}>
      <View style={styles.emojiContainer}>
        <Image
          source={require('@/assets/images/emoji-faces.png')}
          style={styles.emojiImage}
          resizeMode="cover"
        />
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.title}>Microsteps</Text>
        <Text style={styles.subtitle}>as a Path to Growth</Text>
        <Text style={styles.description}>
          Your AI Assistant tells you exactly{'\n'}what to do next
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <AuthButton type="email" onPress={handleEmailSignIn} />
        <AuthButton type="google" onPress={handleGoogleSignIn} />
        <AuthButton type="apple" onPress={handleAppleSignIn} />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => Alert.alert('Privacy Policy')}>
          <Text style={styles.footerLink}>Privacy policy</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Terms of Service')}>
          <Text style={styles.footerLink}>Terms of service</Text>
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
    fontWeight: '700',
    fontStyle: 'italic',
    color: '#000',
    marginBottom: 0,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 28,
    fontWeight: '600',
    fontStyle: 'italic',
    color: '#000',
    marginBottom: 20,
    fontFamily: 'System',
  },
  description: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
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

