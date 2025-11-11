import { AppColors } from '@/constants/Colors';
import { auth } from '@/constants/firebase.config';
import { useAuth } from '@/contexts/AuthContext';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { sendEmailVerificationCode, verifyEmailCode } from '@/services/auth.service';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { isSignInWithEmailLink } from 'firebase/auth';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function EmailConfirmScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { setUser } = useAuth();
  const email = params.email as string;

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('email_confirm_screen_viewed');
    }, [])
  );
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resendTimer, setResendTimer] = useState<number>(60);
  const [canResend, setCanResend] = useState<boolean>(false);
  const [showDebugInput, setShowDebugInput] = useState<boolean>(false);
  const [debugLinkInput, setDebugLinkInput] = useState<string>('');

  const handleEmailLink = useCallback(async (url: string): Promise<void> => {
    setIsLoading(true);
    try {
      console.log('[EmailConfirm] Attempting to verify email with link');
      const user = await verifyEmailCode(email, url);
      console.log('[EmailConfirm] Email verified successfully');
      setUser(user);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('[EmailConfirm] Error verifying email link:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Invalid or expired link.\n\nDetails: ${errorMessage}\n\nPlease try again.`);
    } finally {
      setIsLoading(false);
    }
  }, [email, setUser, router]);

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
      console.log('[EmailConfirm] Received deep link:', url);
      
      // Check if this is a deep link with magicLink parameter (from mobile browser redirect)
      const magicLinkMatch = url.match(/[?&]magicLink=([^&]+)/);
      if (magicLinkMatch) {
        // Extract the full magic link from the URL - need to get everything after magicLink=
        const fullUrl = url.substring(url.indexOf('magicLink=') + 'magicLink='.length);
        // Take everything before &email= if it exists
        const ampIndex = fullUrl.indexOf('&email=');
        const extractedMagicLink = ampIndex > 0 ? fullUrl.substring(0, ampIndex) : fullUrl;
        const decodedMagicLink = decodeURIComponent(extractedMagicLink);
        console.log('[EmailConfirm] Extracted magic link from deep link:', decodedMagicLink);
        await handleEmailLink(decodedMagicLink);
        return;
      }
      
      // Only process if it's a valid Firebase magic link
      if (url && isSignInWithEmailLink(auth, url)) {
        console.log('[EmailConfirm] Valid Firebase magic link detected');
        await handleEmailLink(url);
      } else {
        console.log('[EmailConfirm] Not a valid Firebase magic link, ignoring');
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened with a magic link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[EmailConfirm] Initial URL:', url);
        
        // Check if this is a deep link with magicLink parameter (from mobile browser redirect)
        const magicLinkMatch = url.match(/[?&]magicLink=([^&]+)/);
        if (magicLinkMatch) {
          const fullUrl = url.substring(url.indexOf('magicLink=') + 'magicLink='.length);
          const ampIndex = fullUrl.indexOf('&email=');
          const extractedMagicLink = ampIndex > 0 ? fullUrl.substring(0, ampIndex) : fullUrl;
          const decodedMagicLink = decodeURIComponent(extractedMagicLink);
          console.log('[EmailConfirm] Extracted magic link from initial URL:', decodedMagicLink);
          handleEmailLink(decodedMagicLink);
          return;
        }
        
        // Only process if it's a valid Firebase magic link
        if (isSignInWithEmailLink(auth, url)) {
          console.log('[EmailConfirm] Initial URL is a valid Firebase magic link');
          handleEmailLink(url);
        } else {
          console.log('[EmailConfirm] Initial URL is not a Firebase magic link');
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [email, handleEmailLink]);

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

  const handleDebugSubmit = async (): Promise<void> => {
    if (!debugLinkInput.trim()) {
      Alert.alert('Error', 'Please paste the magic link');
      return;
    }
    await handleEmailLink(debugLinkInput.trim());
  };

  return (
    <View style={styles.container} testID="email-confirm-container">
      <TouchableOpacity style={styles.backButton} onPress={handleBack} testID="back-button">
        <Ionicons name="arrow-back" size={28} color="#000" testID="back-icon" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.closeButton} onPress={handleClose} testID="close-button">
        <Ionicons name="close" size={28} color="#000" testID="close-icon" />
      </TouchableOpacity>

      <View style={styles.content} testID="content">
        <View style={styles.iconContainer} testID="icon-container">
          <Ionicons name="mail-outline" size={64} color="#000" testID="mail-icon" />
        </View>

        <Text style={styles.title} testID="title">Check your email</Text>
        <Text style={styles.subtitle} testID="subtitle">
          We sent a magic link to{'\n'}
          <Text style={styles.emailText} testID="email-text">{email}</Text>
        </Text>

        <Text style={styles.instructionText} testID="instruction-text">
          Click the link in the email to sign in.{'\n'}
          The link will expire in 1 hour.
        </Text>

        <TouchableOpacity onPress={handleResend} disabled={!canResend} testID="resend-button">
          <Text style={[styles.resendText, !canResend && styles.resendTextDisabled]} testID="resend-text">
            {canResend ? 'Resend link' : `Resend link in ${formatTimer(resendTimer)}`}
          </Text>
        </TouchableOpacity>

        {Platform.OS !== 'web' && (
          <TouchableOpacity 
            style={styles.debugButton}
            onPress={() => setShowDebugInput(!showDebugInput)}
            testID="debug-button"
          >
            <Text style={styles.debugButtonText} testID="debug-button-text">
              {showDebugInput ? 'Hide' : 'Paste link manually'}
            </Text>
          </TouchableOpacity>
        )}

        {showDebugInput && (
          <View style={styles.debugContainer} testID="debug-container">
            <Text style={styles.debugTitle} testID="debug-title">Development Mode</Text>
            <Text style={styles.debugInstruction} testID="debug-instruction">
              Paste the magic link from your email:
            </Text>
            <TextInput
              style={styles.debugInput}
              value={debugLinkInput}
              onChangeText={setDebugLinkInput}
              placeholder="http://192.168.1.74:8081/?email=..."
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              testID="debug-input"
            />
            <TouchableOpacity
              style={styles.debugSubmitButton}
              onPress={handleDebugSubmit}
              disabled={!debugLinkInput.trim()}
              testID="debug-submit-button"
            >
              <Text style={styles.debugSubmitText} testID="debug-submit-text">Verify Link</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isLoading && (
        <View style={styles.loadingContainer} testID="loading-container">
          <Text style={styles.loadingText} testID="loading-text">Verifying...</Text>
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
    paddingTop: 30,
    paddingBottom: 0,
  },
  backButton: {
    position: 'absolute',
    top: 30,
    left: 24,
    zIndex: 10,
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
    fontFamily: 'Manrope-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    fontFamily: 'Manrope-Regular',
  },
  emailText: {
    color: '#000',
    fontWeight: '600',
    fontFamily: 'Manrope-SemiBold',
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

