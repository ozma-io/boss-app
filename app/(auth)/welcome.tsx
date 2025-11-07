import { AuthButton } from '@/components/auth/AuthButton';
import { signInWithApple } from '@/services/auth.service';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
        <Text style={styles.emoji}>😊</Text>
        <Text style={styles.emoji}>😌</Text>
        <Text style={styles.emoji}>😄</Text>
        <Text style={styles.emoji}>🙂</Text>
        <Text style={styles.emoji}>😁</Text>
        <Text style={styles.emoji}>😐</Text>
        <Text style={styles.emoji}>😬</Text>
        <Text style={styles.emoji}>😔</Text>
        <Text style={styles.emoji}>🤔</Text>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  emojiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  emoji: {
    fontSize: 40,
    width: 64,
    height: 64,
    textAlign: 'center',
    lineHeight: 64,
    backgroundColor: '#E8E0D5',
    borderRadius: 32,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 24,
    fontStyle: 'italic',
    color: '#000',
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginTop: 'auto',
  },
  footerLink: {
    fontSize: 14,
    color: '#999',
  },
});

