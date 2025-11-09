import { AppColors } from '@/constants/Colors';
import { showIntercomMessenger } from '@/services/intercom.service';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Linking, Platform, StyleSheet, Text, View } from 'react-native';

const SUPPORT_EMAIL = 'support@ozma.io';

export default function SupportScreen() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showCopiedToast, setShowCopiedToast] = useState<boolean>(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-100)).current;

  const handleEmailPress = (): void => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  };

  const handleEmailLongPress = async (): Promise<void> => {
    await Clipboard.setStringAsync(SUPPORT_EMAIL);
    
    // Show toast
    setShowCopiedToast(true);
    
    // Animate in
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Hide after 3 seconds
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowCopiedToast(false);
      });
    }, 3000);
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      setLoading(false);
      return;
    }

    const openMessenger = async (): Promise<void> => {
      try {
        await showIntercomMessenger();
        setLoading(false);
      } catch (err) {
        console.error('Failed to open Intercom messenger:', err);
        setError('Failed to open support messenger. Please try again.');
        setLoading(false);
      }
    };

    openMessenger();
  }, []);

  if (error) {
    return (
      <View style={styles.container} testID="support-error-container">
        <View style={styles.content} testID="support-error-content">
          <View style={styles.iconContainer} testID="support-error-icon-container">
            <FontAwesome name="comments" size={64} color="#B8E986" testID="support-error-icon" />
          </View>
          <Text style={styles.title} testID="support-error-title">Support</Text>
          <View style={styles.infoCard} testID="support-error-card">
            <Text style={styles.infoText} testID="support-error-text">
              {error}
              {'\n\n'}
              Sorry for the inconvenience. You can reach us at{' '}
              <Text style={styles.emailLink} onPress={handleEmailPress} onLongPress={handleEmailLongPress} testID="support-error-email">
                {SUPPORT_EMAIL}
              </Text>
              {'\n'}
              We read all messages.
            </Text>
          </View>
        </View>
        {showCopiedToast && (
          <Animated.View 
            style={[
              styles.toast,
              {
                opacity: toastOpacity,
                transform: [{ translateY: toastTranslateY }],
              },
            ]}
            testID="copied-toast"
          >
            <FontAwesome name="check-circle" size={20} color="#B8E986" />
            <Text style={styles.toastText}>Email copied to clipboard</Text>
          </Animated.View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container} testID="support-loading-container">
        <View style={styles.content} testID="support-loading-content">
          <ActivityIndicator size="large" color="#B8E986" testID="support-loading-indicator" />
          <Text style={styles.loadingText} testID="support-loading-text">Opening support messenger...</Text>
        </View>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container} testID="support-web-container">
        <View style={styles.content} testID="support-web-content">
          <View style={styles.iconContainer} testID="support-web-icon-container">
            <FontAwesome name="mobile" size={64} color="#B8E986" testID="support-web-icon" />
          </View>
          <Text style={styles.title} testID="support-web-title">Support</Text>
          <View style={styles.infoCard} testID="support-web-info-card">
            <Text style={styles.infoText} testID="support-web-info-text">
              Intercom support messenger is available only in the iOS and Android mobile apps.
              {'\n\n'}
              Sorry for the inconvenience. You can reach us at{' '}
              <Text style={styles.emailLink} onPress={handleEmailPress} onLongPress={handleEmailLongPress} testID="support-web-email">
                {SUPPORT_EMAIL}
              </Text>
              {'\n'}
              We read all messages.
            </Text>
          </View>
        </View>
        {showCopiedToast && (
          <Animated.View 
            style={[
              styles.toast,
              {
                opacity: toastOpacity,
                transform: [{ translateY: toastTranslateY }],
              },
            ]}
            testID="copied-toast"
          >
            <FontAwesome name="check-circle" size={20} color="#B8E986" />
            <Text style={styles.toastText}>Email copied to clipboard</Text>
          </Animated.View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container} testID="support-container">
      <View style={styles.content} testID="support-content">
        <View style={styles.iconContainer} testID="support-icon-container">
          <FontAwesome name="comments" size={64} color="#B8E986" testID="support-icon" />
        </View>
        <Text style={styles.title} testID="support-title">Support</Text>
        <Text style={styles.description} testID="support-description">
          The Intercom messenger should be open now.
          {'\n\n'}
          If you don't see it, please try reopening this screen.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    fontFamily: 'Manrope-Bold',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    fontFamily: 'Manrope-Regular',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    fontFamily: 'Manrope-Regular',
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#B8E986',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontFamily: 'Manrope-Regular',
  },
  emailLink: {
    color: '#007AFF',
    textDecorationLine: 'underline',
    fontFamily: 'Manrope-SemiBold',
  },
  toast: {
    position: 'absolute',
    top: 60,
    left: 24,
    right: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#B8E986',
  },
  toastText: {
    fontSize: 15,
    color: '#333',
    fontFamily: 'Manrope-SemiBold',
    flex: 1,
  },
});

