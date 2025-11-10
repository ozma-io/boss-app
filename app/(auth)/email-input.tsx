import { AppColors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { sendEmailVerificationCode, signInWithTestEmail } from '@/services/auth.service';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const TEST_EMAIL = 'test@test.test';

export default function EmailInputScreen(): React.JSX.Element {
  const router = useRouter();
  const { setUser } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Pre-fill email from route params if provided (from attribution)
  useEffect(() => {
    if (params.email && typeof params.email === 'string') {
      console.log('[EmailInput] Pre-filling email from params:', params.email);
      setEmail(params.email);
    }
  }, [params.email]);

  const handleClose = (): void => {
    router.back();
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleContinue = async (): Promise<void> => {
    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      // Check if this is the test email
      if (email === TEST_EMAIL) {
        console.log('[EmailInput] Test email detected, bypassing magic link');
        const user = await signInWithTestEmail(email);
        setUser(user);
        router.replace('/(tabs)');
        return;
      }

      // Normal flow: send magic link
      if (Platform.OS === 'web') {
        window.localStorage.setItem('emailForSignIn', email);
      }
      
      await sendEmailVerificationCode(email);
      router.push({
        pathname: '/(auth)/email-confirm',
        params: { email },
      });
    } catch (error) {
      console.error('[EmailInput] Error sending magic link:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(
        'Error', 
        `Failed to send magic link.\n\nDetails: ${errorMessage}\n\nPlease try again.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      testID="email-input-container"
    >
      <TouchableOpacity style={styles.closeButton} onPress={handleClose} testID="close-button">
        <Ionicons name="close" size={28} color="#000" testID="close-icon" />
      </TouchableOpacity>

      <View style={styles.content} testID="content">
        <Text style={styles.title} testID="title">What's your Email?</Text>
        <Text style={styles.subtitle} testID="subtitle">
          We will send you a four-digit{'\n'}code to this email
        </Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your.email@example.com"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          testID="email-input"
        />
      </View>

      <TouchableOpacity
        style={[styles.continueButton, (!email || !validateEmail(email) || isLoading) && styles.continueButtonDisabled]}
        onPress={handleContinue}
        disabled={!email || !validateEmail(email) || isLoading}
        testID="continue-button"
      >
        <Text style={styles.continueButtonText} testID="continue-button-text">
          {isLoading ? 'Sending...' : 'Continue'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 0,
  },
  closeButton: {
    position: 'absolute',
    top: 30,
    right: 24,
    zIndex: 10,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Manrope-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
    fontFamily: 'Manrope-Regular',
  },
  input: {
    width: '100%',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontFamily: 'Manrope-Regular',
  },
  continueButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 35,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Manrope-SemiBold',
  },
});

