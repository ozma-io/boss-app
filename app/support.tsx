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
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <FontAwesome name="comments" size={64} color="#B8E986" />
          </View>
          <Text style={styles.title}>Support</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>{error}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#B8E986" />
          <Text style={styles.loadingText}>Opening support messenger...</Text>
        </View>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <FontAwesome name="mobile" size={64} color="#B8E986" />
          </View>
          <Text style={styles.title}>Support</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
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
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <FontAwesome name="comments" size={64} color="#B8E986" />
        </View>
        <Text style={styles.title}>Support</Text>
        <Text style={styles.description}>
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
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
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
  },
});

