import { AppColors } from '@/constants/Colors';
import { showIntercomMessenger } from '@/services/intercom.service';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

export default function SupportScreen() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
            <Text style={styles.infoText} testID="support-error-text">{error}</Text>
          </View>
        </View>
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
              Please download and use the mobile app to contact support.
            </Text>
          </View>
        </View>
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
});

