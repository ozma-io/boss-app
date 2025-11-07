import { useAuth } from '@/contexts/AuthContext';
import { sendEmailVerificationCode, verifyEmailCode } from '@/services/auth.service';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function EmailConfirmScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { setUser } = useAuth();
  const email = params.email as string;
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resendTimer, setResendTimer] = useState<number>(60);
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

  useEffect(() => {
    const handleDeepLink = async (event: { url: string }): Promise<void> => {
      const url = event.url;
      if (url) {
        await handleEmailLink(url);
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleEmailLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [email]);

  const handleEmailLink = async (url: string): Promise<void> => {
    setIsLoading(true);
    try {
      const user = await verifyEmailCode(email, url);
      setUser(user);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Invalid or expired link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = (): void => {
    router.back();
  };

  const handleClose = (): void => {
    router.push('/(auth)/welcome');
  };

  const handleResend = async (): Promise<void> => {
    if (!canResend) {
      return;
    }

    try {
      await sendEmailVerificationCode(email);
      setResendTimer(60);
      setCanResend(false);
      Alert.alert('Success', 'Magic link has been resent to your email');
    } catch (error) {
      Alert.alert('Error', 'Failed to resend link. Please try again.');
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
        <View style={styles.iconContainer}>
          <Ionicons name="mail-outline" size={64} color="#000" />
        </View>

        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a magic link to{'\n'}
          <Text style={styles.emailText}>{email}</Text>
        </Text>

        <Text style={styles.instructionText}>
          Click the link in the email to sign in.{'\n'}
          The link will expire in 1 hour.
        </Text>

        <TouchableOpacity onPress={handleResend} disabled={!canResend}>
          <Text style={[styles.resendText, !canResend && styles.resendTextDisabled]}>
            {canResend ? 'Resend link' : `Resend link in ${formatTimer(resendTimer)}`}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Verifying...</Text>
        </View>
      )}
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
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0EDE6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emailText: {
    color: '#000',
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  resendText: {
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
    marginTop: 16,
    textDecorationLine: 'underline',
  },
  resendTextDisabled: {
    color: '#999',
    textDecorationLine: 'none',
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

