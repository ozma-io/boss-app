import { AppColors } from '@/constants/Colors';
import { auth } from '@/constants/firebase.config';
import { KEYBOARD_AWARE_SCROLL_OFFSET } from '@/constants/keyboard';
import { useAuth } from '@/contexts/AuthContext';
import { sendEmailVerificationCode, signInWithTestEmail, verifyEmailCode } from '@/services/auth.service';
import { logger } from '@/services/logger.service';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { isSignInWithEmailLink } from 'firebase/auth';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardController } from 'react-native-keyboard-controller';
import Modal from 'react-native-modal';

const TEST_EMAIL = 'test@test.test';

// Check if email matches test[+.*]@ozma.io pattern
const isTestOzmaEmail = (email: string): boolean => {
  const testOzmaPattern = /^test(\+.*)?@ozma\.io$/;
  return testOzmaPattern.test(email);
};

interface EmailAuthModalProps {
  isVisible: boolean;
  onClose: () => void;
  initialEmail?: string;
}

type ScreenType = 'email-input' | 'email-confirm';

export function EmailAuthModal({ isVisible, onClose, initialEmail }: EmailAuthModalProps): React.JSX.Element {
  const router = useRouter();
  const { setUser } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('email-input');
  const [email, setEmail] = useState<string>(initialEmail || '');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resendTimer, setResendTimer] = useState<number>(60);
  const [canResend, setCanResend] = useState<boolean>(false);
  const [showDebugInput, setShowDebugInput] = useState<boolean>(false);
  const [debugLinkInput, setDebugLinkInput] = useState<string>('');

  // Update email when initialEmail prop changes
  useEffect(() => {
    if (initialEmail) {
      logger.info('Pre-filling email from props', { feature: 'EmailAuthModal', email: initialEmail });
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailLink = useCallback(
    async (url: string): Promise<void> => {
      setIsLoading(true);
      try {
        logger.info('Attempting to verify email with link', { feature: 'EmailAuthModal', email });
        const user = await verifyEmailCode(email, url);
        logger.info('Email verified successfully', { feature: 'EmailAuthModal', email });
        setUser(user);
        onClose();
        router.replace('/(tabs)');
      } catch (error) {
        logger.error('Failed to verify email link', { feature: 'EmailAuthModal', email, error: error instanceof Error ? error : new Error(String(error)) });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('Error', `Invalid or expired link.\n\nDetails: ${errorMessage}\n\nPlease try again.`);
      } finally {
        setIsLoading(false);
      }
    },
    [email, setUser, router, onClose]
  );

  useEffect(() => {
    if (currentScreen === 'email-confirm' && resendTimer > 0) {
      const timerId = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timerId);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
  }, [currentScreen, resendTimer]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const handleDeepLink = async (event: { url: string }): Promise<void> => {
      const url = event.url;
      logger.info('Received deep link', { feature: 'EmailAuthModal', url });

      const magicLinkMatch = url.match(/[?&]magicLink=([^&]+)/);
      if (magicLinkMatch) {
        const fullUrl = url.substring(url.indexOf('magicLink=') + 'magicLink='.length);
        const ampIndex = fullUrl.indexOf('&email=');
        const extractedMagicLink = ampIndex > 0 ? fullUrl.substring(0, ampIndex) : fullUrl;
        const decodedMagicLink = decodeURIComponent(extractedMagicLink);
        logger.info('Extracted magic link from deep link', { feature: 'EmailAuthModal' });
        await handleEmailLink(decodedMagicLink);
        return;
      }

      if (url && isSignInWithEmailLink(auth, url)) {
        logger.info('Valid Firebase magic link detected', { feature: 'EmailAuthModal' });
        await handleEmailLink(url);
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) {
        logger.info('Initial URL detected', { feature: 'EmailAuthModal', url });

        const magicLinkMatch = url.match(/[?&]magicLink=([^&]+)/);
        if (magicLinkMatch) {
          const fullUrl = url.substring(url.indexOf('magicLink=') + 'magicLink='.length);
          const ampIndex = fullUrl.indexOf('&email=');
          const extractedMagicLink = ampIndex > 0 ? fullUrl.substring(0, ampIndex) : fullUrl;
          const decodedMagicLink = decodeURIComponent(extractedMagicLink);
          logger.info('Extracted magic link from initial URL', { feature: 'EmailAuthModal' });
          handleEmailLink(decodedMagicLink);
          return;
        }

        if (isSignInWithEmailLink(auth, url)) {
          logger.info('Initial URL is a valid Firebase magic link', { feature: 'EmailAuthModal' });
          handleEmailLink(url);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isVisible, email, handleEmailLink]);

  const handleContinue = async (): Promise<void> => {
    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    // Dismiss keyboard before proceeding to prevent double-tap issue
    KeyboardController.dismiss();

    setIsLoading(true);
    try {
      // Check if this is a test email (test@test.test or test[+.*]@ozma.io)
      const isTestEmailMatch = email === TEST_EMAIL;
      const isOzmaTestEmail = isTestOzmaEmail(email);
      
      logger.info('Email auth check', { 
        feature: 'EmailAuthModal', 
        email, 
        isTestEmailMatch, 
        isOzmaTestEmail 
      });
      
      if (isTestEmailMatch || isOzmaTestEmail) {
        logger.info('Test email detected, bypassing magic link', { feature: 'EmailAuthModal', email });
        const user = await signInWithTestEmail(email);
        setUser(user);
        onClose();
        router.replace('/(tabs)');
        return;
      }

      if (Platform.OS === 'web') {
        window.localStorage.setItem('emailForSignIn', email);
      }

      await sendEmailVerificationCode(email);
      setCurrentScreen('email-confirm');
      setResendTimer(60);
      setCanResend(false);
    } catch (error) {
      logger.error('Failed to send magic link', { feature: 'EmailAuthModal', email, error: error instanceof Error ? error : new Error(String(error)) });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to send magic link.\n\nDetails: ${errorMessage}\n\nPlease try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = (): void => {
    setCurrentScreen('email-input');
  };

  const handleClose = (): void => {
    // Dismiss keyboard with animation before closing modal
    KeyboardController.dismiss();
    
    setCurrentScreen('email-input');
    setEmail('');
    setIsLoading(false);
    setResendTimer(60);
    setCanResend(false);
    setShowDebugInput(false);
    setDebugLinkInput('');
    onClose();
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

  const handleDebugSubmit = async (): Promise<void> => {
    if (!debugLinkInput.trim()) {
      Alert.alert('Error', 'Please paste the magic link');
      return;
    }
    await handleEmailLink(debugLinkInput.trim());
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={handleClose}
      onSwipeComplete={handleClose}
      swipeDirection={['down']}
      style={styles.modal}
      propagateSwipe
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropOpacity={0.35}
    >
      <KeyboardAwareScrollView
        style={styles.modalContent}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bottomOffset={KEYBOARD_AWARE_SCROLL_OFFSET}
        keyboardShouldPersistTaps="handled"
      >
        {currentScreen === 'email-input' ? (
          <View style={styles.container}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>

              <View style={styles.content}>
                <Text style={styles.title}>What's your Email?</Text>
                <Text style={styles.subtitle}>
                  We'll email you a link to sign in.{'\n'}No password needed.
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
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.continueButton,
                  (!email || !validateEmail(email) || isLoading) && styles.continueButtonDisabled,
                ]}
                onPress={handleContinue}
                disabled={!email || !validateEmail(email) || isLoading}
              >
            <Text style={styles.continueButtonText}>{isLoading ? 'Sending...' : 'Continue'}</Text>
          </TouchableOpacity>
          </View>
        ) : (
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

              {Platform.OS !== 'web' && (
                <TouchableOpacity
                  style={styles.debugButton}
                  onPress={() => setShowDebugInput(!showDebugInput)}
                >
                  <Text style={styles.debugButtonText}>
                    {showDebugInput ? 'Hide' : 'Paste link manually'}
                  </Text>
                </TouchableOpacity>
              )}

              {showDebugInput && (
                <View style={styles.debugContainer}>
                  <Text style={styles.debugTitle}>Development Mode</Text>
                  <Text style={styles.debugInstruction}>Paste the magic link from your email:</Text>
                  <TextInput
                    style={styles.debugInput}
                    value={debugLinkInput}
                    onChangeText={setDebugLinkInput}
                    placeholder="http://192.168.1.74:8081/?email=..."
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                  />
                  <TouchableOpacity
                    style={styles.debugSubmitButton}
                    onPress={handleDebugSubmit}
                    disabled={!debugLinkInput.trim()}
                  >
                    <Text style={styles.debugSubmitText}>Verify Link</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {isLoading && (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Verifying...</Text>
              </View>
            )}
          </View>
        )}
      </KeyboardAwareScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    maxHeight: '90%',
    backgroundColor: '#FAF8F5',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
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
  backButton: {
    position: 'absolute',
    top: 30,
    left: 24,
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
  emailText: {
    color: '#000',
    fontWeight: '600',
    fontFamily: 'Manrope-SemiBold',
  },
  input: {
    width: '100%',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    fontSize: 16,
    color: '#000',
    fontFamily: 'Manrope-Regular',
  },
  continueButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 30,
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
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0EDE6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  instructionText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    fontFamily: 'Manrope-Regular',
  },
  resendText: {
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
    marginTop: 16,
    textDecorationLine: 'underline',
    fontFamily: 'Manrope-Regular',
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
    fontFamily: 'Manrope-SemiBold',
  },
  debugButton: {
    marginTop: 32,
    paddingVertical: 8,
  },
  debugButtonText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontFamily: 'Manrope-Regular',
  },
  debugContainer: {
    marginTop: 24,
    width: '100%',
    backgroundColor: '#F0EDE6',
    padding: 16,
    borderRadius: 12,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    fontFamily: 'Manrope-SemiBold',
  },
  debugInstruction: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    fontFamily: 'Manrope-Regular',
  },
  debugInput: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    fontSize: 12,
    color: '#000',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 12,
    minHeight: 80,
    fontFamily: 'Manrope-Regular',
  },
  debugSubmitButton: {
    backgroundColor: '#000',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  debugSubmitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Manrope-SemiBold',
  },
});

