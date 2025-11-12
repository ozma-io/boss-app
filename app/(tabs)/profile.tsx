import { FloatingChatButton } from '@/components/FloatingChatButton';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { signOut } from '@/services/auth.service';
import { showIntercomMessenger } from '@/services/intercom.service';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top;
  
  const { user } = useAuth();
  const { profile, loading, error, updateProfile } = useUserProfile();
  
  const [goalDescription, setGoalDescription] = useState('');
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [position, setPosition] = useState('');
  const [isEditingPosition, setIsEditingPosition] = useState(false);
  const [department, setDepartment] = useState('');
  const [isEditingDepartment, setIsEditingDepartment] = useState(false);

  // TODO: These metrics should be calculated dynamically based on:
  // - Timeline entries (fact entries with stress/confidence assessments)
  // - Interaction mood patterns over time
  // - Survey response trends
  // For now using placeholder values
  const mockMetrics = {
    stressLevel: 0.25,
    bossRelationshipChallenges: 0.20,
    selfDoubtConfidenceGap: 0.30,
  };

  // Sync local state with profile data when it loads
  useEffect(() => {
    if (profile) {
      setGoalDescription(profile.custom_goal || '');
      setPosition(profile.custom_position || '');
      setDepartment(profile.custom_department || '');
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('profile_screen_viewed');
      
      if (profile) {
        trackAmplitudeEvent('profile_data_loaded', {
          hasGoal: !!profile.custom_goal,
          hasPosition: !!profile.custom_position,
          hasDepartment: !!profile.custom_department,
        });
      }
    }, [profile])
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

  const handleBlurGoal = async (): Promise<void> => {
    setIsEditingGoal(false);
    if (goalDescription !== profile?.custom_goal) {
      try {
        await updateProfile({ custom_goal: goalDescription });
        trackAmplitudeEvent('profile_field_edited', {
          field: 'goal',
        });
      } catch (err) {
        console.error('Failed to update goal:', err);
      }
    }
  };

  const handleEditPosition = (): void => {
    setIsEditingPosition(true);
  };

  const handleBlurPosition = async (): Promise<void> => {
    setIsEditingPosition(false);
    if (position !== profile?.custom_position) {
      try {
        await updateProfile({ custom_position: position });
        trackAmplitudeEvent('profile_field_edited', {
          field: 'position',
        });
      } catch (err) {
        console.error('Failed to update position:', err);
      }
    }
  };

  const handleEditDepartment = (): void => {
    setIsEditingDepartment(true);
  };

  const handleBlurDepartment = async (): Promise<void> => {
    setIsEditingDepartment(false);
    if (department !== profile?.custom_department) {
      try {
        await updateProfile({ custom_department: department });
        trackAmplitudeEvent('profile_field_edited', {
          field: 'department',
        });
      } catch (err) {
        console.error('Failed to update department:', err);
      }
    }
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
      {loading ? (
        <View style={styles.centerContent} testID="profile-loading">
          <ActivityIndicator size="large" color="#B6D95C" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent} testID="profile-error">
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>Please check your connection or try again later.</Text>
        </View>
      ) : !profile ? (
        <View style={styles.centerContent} testID="profile-empty">
          <Text style={styles.emptyIcon}>👤</Text>
          <Text style={styles.emptyText}>Profile not found</Text>
          <Text style={styles.emptyHint}>Please try signing in again</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} testID="profile-scroll-view">
        <View style={[styles.header, { paddingTop: topInset + 16 }]} testID="profile-header">
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
          <Text style={styles.username} testID="username-text">{profile.displayName || 'User'}</Text>
          <Text style={styles.email} testID="email-text">{profile.email}</Text>
        </View>

        <View style={styles.goalCard} testID="goal-card">
          <Image 
            source={require('@/assets/images/flag-icon.png')} 
            style={styles.cardIcon}
            resizeMode="contain"
            testID="goal-flag-icon"
          />
          <View style={styles.cardContent} testID="goal-content">
            <Text style={styles.cardLabel} testID="goal-label">Your Goal: </Text>
            {isEditingGoal ? (
              <TextInput
                style={[styles.cardValueInput, { outlineStyle: 'none' } as any]}
                value={goalDescription}
                onChangeText={setGoalDescription}
                onBlur={handleBlurGoal}
                autoFocus
                placeholder="Enter your goal"
                testID="goal-input"
              />
            ) : (
              <Text style={styles.cardValue} testID="goal-description">{goalDescription}</Text>
            )}
          </View>
          {!isEditingGoal && (
            <TouchableOpacity onPress={handleEditGoal} style={styles.cardEditButton} testID="goal-edit-button">
              <FontAwesome name="pencil" size={18} color="#333" testID="goal-edit-icon" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.infoCard} testID="position-card">
          <Image 
            source={require('@/assets/images/briefcase-icon.png')} 
            style={styles.cardIcon}
            resizeMode="contain"
            testID="position-briefcase-icon"
          />
          <View style={styles.cardContent} testID="position-content">
            <Text style={styles.cardLabel} testID="position-label">Position: </Text>
            {isEditingPosition ? (
              <TextInput
                style={[styles.cardValueInput, { outlineStyle: 'none' } as any]}
                value={position}
                onChangeText={setPosition}
                onBlur={handleBlurPosition}
                autoFocus
                placeholder="Enter your position"
                testID="position-input"
              />
            ) : (
              <Text style={styles.cardValue} testID="position-description">{position}</Text>
            )}
          </View>
          {!isEditingPosition && (
            <TouchableOpacity onPress={handleEditPosition} style={styles.cardEditButton} testID="position-edit-button">
              <FontAwesome name="pencil" size={18} color="#333" testID="position-edit-icon" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.infoCard} testID="department-card">
          <Image 
            source={require('@/assets/images/department-icon.png')} 
            style={styles.cardIcon}
            resizeMode="contain"
            testID="department-building-icon"
          />
          <View style={styles.cardContent} testID="department-content">
            <Text style={styles.cardLabel} testID="department-label">Department: </Text>
            {isEditingDepartment ? (
              <TextInput
                style={[styles.cardValueInput, { outlineStyle: 'none' } as any]}
                value={department}
                onChangeText={setDepartment}
                onBlur={handleBlurDepartment}
                autoFocus
                placeholder="Enter your department"
                testID="department-input"
              />
            ) : (
              <Text style={styles.cardValue} testID="department-description">{department}</Text>
            )}
          </View>
          {!isEditingDepartment && (
            <TouchableOpacity onPress={handleEditDepartment} style={styles.cardEditButton} testID="department-edit-button">
              <FontAwesome name="pencil" size={18} color="#333" testID="department-edit-icon" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.metricsSection} testID="metrics-section">
          <Text style={styles.sectionTitle} testID="metrics-title">Where You Now</Text>

          <View style={styles.metricItem} testID="metric-stress-level">
            <View style={styles.metricHeader} testID="metric-stress-level-header">
              <Text style={styles.metricLabel} testID="metric-stress-level-label">Your stress level</Text>
              <Text style={styles.metricValue} testID="metric-stress-level-value">Higher than {Math.round(mockMetrics.stressLevel * 100)}%</Text>
            </View>
            {renderProgressBar(mockMetrics.stressLevel, '#B8E986', 'metric-stress-level-progress')}
          </View>

          <View style={styles.metricItem} testID="metric-boss-challenges">
            <View style={styles.metricHeader} testID="metric-boss-challenges-header">
              <Text style={styles.metricLabel} testID="metric-boss-challenges-label">Boss relationship challenges</Text>
              <Text style={styles.metricValue} testID="metric-boss-challenges-value">More than {Math.round(mockMetrics.bossRelationshipChallenges * 100)}%</Text>
            </View>
            {renderProgressBar(mockMetrics.bossRelationshipChallenges, '#FF6B6B', 'metric-boss-challenges-progress')}
          </View>

          <View style={styles.metricItem} testID="metric-confidence-gap">
            <View style={styles.metricHeader} testID="metric-confidence-gap-header">
              <Text style={styles.metricLabel} testID="metric-confidence-gap-label">Self-doubt / confidence gap</Text>
              <Text style={styles.metricValue} testID="metric-confidence-gap-value">Higher than {Math.round(mockMetrics.selfDoubtConfidenceGap * 100)}%</Text>
            </View>
            {renderProgressBar(mockMetrics.selfDoubtConfidenceGap, '#B8E986', 'metric-confidence-gap-progress')}
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
      </ScrollView>
      )}

      <FloatingChatButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F1E8',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontFamily: 'Manrope-Regular',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Manrope-SemiBold',
  },
  errorHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontFamily: 'Manrope-Regular',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Manrope-SemiBold',
  },
  emptyHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontFamily: 'Manrope-Regular',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 70,
  },
  header: {
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
    marginBottom: 8,
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'Manrope-Bold',
  },
  cardValue: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Manrope-Regular',
    flex: 1,
  },
  cardValueInput: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Manrope-Regular',
    flex: 1,
    padding: 0,
    margin: 0,
    borderWidth: 0,
  },
  cardEditButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
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
});

