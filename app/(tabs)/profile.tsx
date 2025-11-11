import { FloatingChatButton } from '@/components/FloatingChatButton';
import { useAuth } from '@/contexts/AuthContext';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { signOut } from '@/services/auth.service';
import { showIntercomMessenger } from '@/services/intercom.service';
import { openPrivacyPolicy, openTermsOfService } from '@/services/policy.service';
import { mockUserGoal, mockUserMetrics, mockUserProfile } from '@/utils/mockData';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [goalDescription, setGoalDescription] = useState(mockUserGoal.description);
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('profile_screen_viewed');
    }, [])
  );

  const handleSignOut = async (): Promise<void> => {
    trackAmplitudeEvent('auth_signout_clicked', {
      email: user?.email || '[no_email]',
      screen: 'profile',
    });
    
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
      console.error('Sign out error:', error);
    }
  };

  const handleEditGoal = (): void => {
    setIsEditingGoal(true);
  };

  const handleBlurGoal = (): void => {
    setIsEditingGoal(false);
  };

  const handleOpenPersonalInfo = (): void => {
    router.push('/personal-info');
  };

  const handleOpenSubscription = (): void => {
    router.push('/subscription');
  };

  const handleOpenSupport = async (): Promise<void> => {
    if (Platform.OS === 'web') {
      const shouldSendEmail = window.confirm(
        'Support\n\nFor support, please email us at support@ozma.io\n\nWe read all messages and will get back to you as soon as possible.\n\nWould you like to open your email client now?'
      );
      
      if (shouldSendEmail) {
        Linking.openURL('mailto:support@ozma.io');
      }
    } else {
      try {
        await showIntercomMessenger();
      } catch (error) {
        console.error('Failed to open Intercom messenger:', error);
        Alert.alert(
          'Support Error',
          'Failed to open support messenger. Please email us at support@ozma.io',
          [
            {
              text: 'Send Email',
              onPress: () => Linking.openURL('mailto:support@ozma.io'),
            },
            {
              text: 'OK',
              style: 'cancel',
            },
          ]
        );
      }
    }
  };

  const renderProgressBar = (value: number, color: string, testId: string) => {
    return (
      <View style={styles.progressBarContainer} testID={`${testId}-container`}>
        <View style={styles.progressBarBackground} testID={`${testId}-background`}>
          <View style={[styles.progressBarFill, { width: `${value * 100}%`, backgroundColor: color }]} testID={`${testId}-fill`} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container} testID="profile-container">
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} testID="profile-scroll-view">
        <View style={styles.header} testID="profile-header">
          <Text style={styles.headerTitle} testID="header-title">The Boss App</Text>
        </View>

        <View style={styles.profileSection} testID="profile-section">
          <View style={styles.avatarContainer} testID="avatar-container">
            <Image 
              source={require('@/assets/images/avatar.png')} 
              style={styles.avatar}
              resizeMode="contain"
              testID="avatar-image"
            />
          </View>
          <Text style={styles.username} testID="username-text">{mockUserProfile.username}</Text>
          <Text style={styles.email} testID="email-text">{user?.email || mockUserProfile.email}</Text>
        </View>

        <View style={styles.goalCard} testID="goal-card">
          <View style={styles.goalHeader} testID="goal-header">
            <View style={styles.goalTitleContainer} testID="goal-title-container">
              <FontAwesome name="flag" size={20} color="#333" testID="goal-flag-icon" />
              <Text style={styles.goalTitle} testID="goal-title">{mockUserGoal.title}</Text>
            </View>
            {!isEditingGoal && (
              <TouchableOpacity onPress={handleEditGoal} style={styles.editButton} testID="goal-edit-button">
                <FontAwesome name="pencil" size={18} color="#333" testID="goal-edit-icon" />
              </TouchableOpacity>
            )}
          </View>
          {isEditingGoal ? (
              <TextInput
              style={[styles.goalInput, { outlineStyle: 'none' } as any]}
                value={goalDescription}
                onChangeText={setGoalDescription}
              onBlur={handleBlurGoal}
                multiline
                autoFocus
                placeholder="Enter your goal"
                testID="goal-input"
              />
          ) : (
            <Text style={styles.goalDescription} testID="goal-description">{goalDescription}</Text>
          )}
        </View>

        <View style={styles.metricsSection} testID="metrics-section">
          <Text style={styles.sectionTitle} testID="metrics-title">Where You Now</Text>

          <View style={styles.metricItem} testID="metric-stress-level">
            <View style={styles.metricHeader} testID="metric-stress-level-header">
              <Text style={styles.metricLabel} testID="metric-stress-level-label">Your stress level</Text>
              <Text style={styles.metricValue} testID="metric-stress-level-value">Higher than {Math.round(mockUserMetrics.stressLevel * 100)}%</Text>
            </View>
            {renderProgressBar(mockUserMetrics.stressLevel, '#B8E986', 'metric-stress-level-progress')}
          </View>

          <View style={styles.metricItem} testID="metric-boss-challenges">
            <View style={styles.metricHeader} testID="metric-boss-challenges-header">
              <Text style={styles.metricLabel} testID="metric-boss-challenges-label">Boss relationship challenges</Text>
              <Text style={styles.metricValue} testID="metric-boss-challenges-value">More than {Math.round(mockUserMetrics.bossRelationshipChallenges * 100)}%</Text>
            </View>
            {renderProgressBar(mockUserMetrics.bossRelationshipChallenges, '#FF6B6B', 'metric-boss-challenges-progress')}
          </View>

          <View style={styles.metricItem} testID="metric-confidence-gap">
            <View style={styles.metricHeader} testID="metric-confidence-gap-header">
              <Text style={styles.metricLabel} testID="metric-confidence-gap-label">Self-doubt / confidence gap</Text>
              <Text style={styles.metricValue} testID="metric-confidence-gap-value">Higher than {Math.round(mockUserMetrics.selfDoubtConfidenceGap * 100)}%</Text>
            </View>
            {renderProgressBar(mockUserMetrics.selfDoubtConfidenceGap, '#B8E986', 'metric-confidence-gap-progress')}
          </View>
        </View>

        <View style={styles.settingsSectionContainer} testID="settings-section-container">
          <Text style={styles.sectionTitle} testID="settings-title">Settings</Text>
          <View style={styles.settingsSection} testID="settings-section">
            <Pressable
              style={({ pressed }) => [
                styles.settingsItem,
                pressed && styles.settingsItemPressed
              ]}
              onPress={handleOpenPersonalInfo}
              testID="settings-personal-info-button"
            >
              <Text style={styles.settingsItemText} testID="settings-personal-info-text">Personal information</Text>
              <FontAwesome name="chevron-right" size={16} color="#666" testID="settings-personal-info-icon" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.settingsItem,
                pressed && styles.settingsItemPressed
              ]}
              onPress={handleOpenSubscription}
              testID="settings-subscription-button"
            >
              <Text style={styles.settingsItemText} testID="settings-subscription-text">Subscription</Text>
              <FontAwesome name="chevron-right" size={16} color="#666" testID="settings-subscription-icon" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.settingsItem,
                pressed && styles.settingsItemPressed
              ]}
              onPress={handleOpenSupport}
              testID="settings-support-button"
            >
              <Text style={styles.settingsItemText} testID="settings-support-text">Support</Text>
              <FontAwesome name="chevron-right" size={16} color="#666" testID="settings-support-icon" />
            </Pressable>
          </View>
        </View>

        <View style={styles.footer} testID="footer">
          <Pressable onPress={openPrivacyPolicy} testID="footer-privacy-button">
            <Text style={styles.footerLink} testID="footer-privacy-text">Privacy policy</Text>
          </Pressable>
          <Pressable onPress={openTermsOfService} testID="footer-terms-button">
            <Text style={styles.footerLink} testID="footer-terms-text">Terms of service</Text>
          </Pressable>
        </View>
      </ScrollView>

      <FloatingChatButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F1E8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingTop: 27,
    paddingBottom: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Manrope-SemiBold',
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 36,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    marginBottom: 12,
  },
  avatar: {
    width: 120,
    height: 120,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    fontFamily: 'Manrope-Bold',
  },
  email: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Manrope-Regular',
  },
  goalCard: {
    backgroundColor: '#B8E986',
    marginHorizontal: 12,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    fontFamily: 'Manrope-SemiBold',
  },
  editButton: {
    padding: 4,
  },
  goalDescription: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Manrope-Regular',
  },
  goalInput: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Manrope-Regular',
    padding: 0,
    margin: 0,
    borderWidth: 0,
  },
  metricsSection: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
    fontFamily: 'Manrope-Bold',
  },
  metricItem: {
    marginBottom: 20,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    fontFamily: 'Manrope-Regular',
  },
  metricValue: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Manrope-Regular',
  },
  progressBarContainer: {
    width: '100%',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  settingsSectionContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  settingsSection: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  settingsItemPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  settingsItemText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Manrope-Regular',
  },
  footer: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  footerLink: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    fontFamily: 'Manrope-Regular',
  },
});

