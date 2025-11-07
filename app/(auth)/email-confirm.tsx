import { CodeInput } from '@/components/auth/CodeInput';
import { useAuth } from '@/contexts/AuthContext';
import { sendEmailVerificationCode, verifyEmailCode } from '@/services/auth.service';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function EmailConfirmScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { setUser } = useAuth();
  const email = params.email as string;
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resendTimer, setResendTimer] = useState<number>(28);
  const [canResend, setCanResend] = useState<boolean>(false);

  useEffect(() => {
    if (resendTimer > 0) {
      const timerId = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timerId);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  const handleBack = (): void => {
    router.back();
  };

  const handleClose = (): void => {
    router.push('/(auth)/welcome');
  };

  const handleCodeComplete = async (code: string): Promise<void> => {
    setIsLoading(true);
    try {
      const emailLink = `${process.env.EXPO_PUBLIC_APP_URL || 'exp://localhost:8081'}?code=${code}&email=${email}`;
      const user = await verifyEmailCode(email, emailLink);
      setUser(user);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    if (!canResend) {
      return;
    }

    try {
      await sendEmailVerificationCode(email);
      setResendTimer(28);
      setCanResend(false);
      Alert.alert('Success', 'Verification code has been resent');
    } catch (error) {
      Alert.alert('Error', 'Failed to resend code. Please try again.');
    }
  };

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Ionicons name="arrow-back" size={28} color="#000" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
        <Ionicons name="close" size={28} color="#000" />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Confirm Email</Text>
        <Text style={styles.subtitle}>
          Code has been sent{'\n'}to {email}
        </Text>

        <CodeInput onCodeComplete={handleCodeComplete} />

        <TouchableOpacity onPress={handleResend} disabled={!canResend}>
          <Text style={[styles.resendText, !canResend && styles.resendTextDisabled]}>
            {canResend ? 'Resend code' : `Resend code in ${formatTimer(resendTimer)}`}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
        disabled={isLoading}
      >
        <Text style={styles.continueButtonText}>
          {isLoading ? 'Verifying...' : 'Continue'}
        </Text>
      </TouchableOpacity>
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
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    zIndex: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  resendText: {
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
    marginTop: 16,
  },
  resendTextDisabled: {
    color: '#999',
  },
  continueButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 'auto',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

