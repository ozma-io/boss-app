import { AddCustomFieldButton } from '@/components/AddCustomFieldButton';
import { AddCustomFieldModal } from '@/components/AddCustomFieldModal';
import { FloatingChatButton } from '@/components/FloatingChatButton';
import { InlineEditableHeading } from '@/components/InlineEditableHeading';
import { SwipeableCustomFieldRow } from '@/components/SwipeableCustomFieldRow';
import { KEYBOARD_AWARE_SCROLL_OFFSET } from '@/constants/keyboard';
import { useAuth } from '@/contexts/AuthContext';
import { isUserFieldRequired } from '@/firestore/schemas/field-presets';
import { useUserProfile } from '@/hooks/useUserProfile';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { signOut } from '@/services/auth.service';
import { showIntercomMessenger } from '@/services/intercom.service';
import { logger } from '@/services/logger.service';
import { showAlert } from '@/utils/alert';
import { generateUniqueFieldKey } from '@/utils/customFieldHelpers';
import { getCustomFields } from '@/utils/fieldHelpers';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import { deleteField } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top;
  
  const { user } = useAuth();
  const { profile, loading, error, updateProfile } = useUserProfile();
  
  // Local state for editing fields (to track changes before saving)
  const [goalValue, setGoalValue] = useState('');
  const [positionValue, setPositionValue] = useState('');
  
  // State for custom field management
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [fieldKeyToEdit, setFieldKeyToEdit] = useState<string | null>(null);
  const [fieldToEdit, setFieldToEdit] = useState<{label: string; value: any; type: 'text' | 'multiline' | 'select' | 'date' | 'multiselect'} | null>(null);

  // Ref to always access latest profile value without affecting callback dependencies
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Sync local state with profile data
  useEffect(() => {
    if (profile) {
      setGoalValue(profile.goal || '');
      setPositionValue(profile.position || '');
    }
  }, [profile]);

  const handleCloseModal = useCallback((): void => {
    setIsAddModalVisible(false);
    setFieldKeyToEdit(null);
    setFieldToEdit(null);
  }, []);

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

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('profile_screen_viewed');
      
      if (profile) {
        trackAmplitudeEvent('profile_data_loaded', {
          hasGoal: !!profile.goal,
          hasPosition: !!profile.position,
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
      showAlert('Error', 'Failed to sign out. Please try again.');
      logger.error('Failed to sign out', { feature: 'ProfileScreen', error: error instanceof Error ? error : new Error(String(error)) });
    }
  };

  const handleBlurGoal = async (): Promise<void> => {
    if (goalValue !== profile?.goal) {
      try {
        await updateProfile({ goal: goalValue });
        trackAmplitudeEvent('profile_field_edited', {
          field: 'goal',
        });
      } catch (err) {
        logger.error('Failed to update goal', { feature: 'ProfileScreen', error: err instanceof Error ? err : new Error(String(err)) });
        // Revert to original value on error
        setGoalValue(profile?.goal || '');
      }
    }
  };

  const handleBlurPosition = async (): Promise<void> => {
    if (positionValue !== profile?.position) {
      try {
        await updateProfile({ position: positionValue });
        trackAmplitudeEvent('profile_field_edited', {
          field: 'position',
        });
      } catch (err) {
        logger.error('Failed to update position', { feature: 'ProfileScreen', error: err instanceof Error ? err : new Error(String(err)) });
        // Revert to original value on error
        setPositionValue(profile?.position || '');
      }
    }
  };

  // Handler for custom fields
  const handleCustomFieldUpdate = async (fieldKey: string, value: any): Promise<void> => {
    if (!profile) return;
    
    try {
      await updateProfile({ [fieldKey]: value });
      trackAmplitudeEvent('profile_field_edited', {
        field: fieldKey,
      });
    } catch (err) {
      logger.error('Failed to update custom field', { feature: 'ProfileScreen', fieldKey, error: err instanceof Error ? err : new Error(String(err)) });
    }
  };

  // Handler for creating empty custom field
  const handleCreateEmptyCustomField = useCallback(async (): Promise<string> => {
    const currentProfile = profileRef.current;
    if (!currentProfile) {
      throw new Error('Profile not loaded');
    }

    const fieldKey = generateUniqueFieldKey(currentProfile);

    try {
      await updateProfile({
        [fieldKey]: '',
        [`_fieldsMeta.${fieldKey}`]: {
          label: '',
          type: 'text',
          source: 'user_added',
          createdAt: new Date().toISOString(),
          displayOrder: Object.keys(currentProfile._fieldsMeta || {}).length,
        },
      });

      trackAmplitudeEvent('profile_custom_field_added', {
        fieldKey,
        type: 'text',
      });

      logger.info('Empty custom field created', {
        feature: 'ProfileScreen',
        fieldKey,
      });

      return fieldKey;
    } catch (err) {
      logger.error('Failed to create empty custom field', {
        feature: 'ProfileScreen',
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    }
  }, [updateProfile]);

  // Handler for updating custom field metadata (label, type) or value
  const handleUpdateCustomField = useCallback(async (
    fieldKey: string,
    updates: { label?: string; type?: 'text' | 'multiline' | 'select' | 'date' | 'multiselect'; value?: string }
  ): Promise<void> => {
    const currentProfile = profileRef.current;
    if (!currentProfile) return;

    try {
      const updatePayload: Record<string, any> = {};

      // Update value if provided
      if (updates.value !== undefined) {
        updatePayload[fieldKey] = updates.value;
      }

      // Update metadata if label or type provided
      if (updates.label !== undefined) {
        updatePayload[`_fieldsMeta.${fieldKey}.label`] = updates.label;
      }
      if (updates.type !== undefined) {
        updatePayload[`_fieldsMeta.${fieldKey}.type`] = updates.type;
      }

      await updateProfile(updatePayload);

      logger.debug('Custom field updated', {
        feature: 'ProfileScreen',
        fieldKey,
        updates,
      });
    } catch (err) {
      logger.error('Failed to update custom field', {
        feature: 'ProfileScreen',
        fieldKey,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    }
  }, [updateProfile]);

  // Handler for deleting custom field
  const handleDeleteCustomField = (fieldKey: string): void => {
    if (!profile) return;

    // Check if field can be deleted
    if (isUserFieldRequired(fieldKey)) {
      showAlert('Error', 'Cannot delete required field');
      return;
    }

    const fieldLabel = profile._fieldsMeta?.[fieldKey]?.label || fieldKey;

    showAlert(
      'Delete Field',
      `Are you sure you want to delete "${fieldLabel}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateProfile({
                [fieldKey]: deleteField(),
                [`_fieldsMeta.${fieldKey}`]: deleteField(),
              });

              trackAmplitudeEvent('profile_custom_field_deleted', {
                fieldKey,
              });

              logger.info('Custom field deleted', {
                feature: 'ProfileScreen',
                fieldKey,
              });
            } catch (err) {
              logger.error('Failed to delete custom field', {
                feature: 'ProfileScreen',
                fieldKey,
                error: err instanceof Error ? err : new Error(String(err)),
              });
              showAlert(
                'Something went wrong',
                'We couldn\'t delete this field right now. Our team has been notified and is working on it. Please try again later.'
              );
            }
          },
        },
      ]
    );
  };

  const handleEditCustomField = (field: { key: string; value: any; metadata: { label: string; type: 'text' | 'multiline' | 'select' | 'date' | 'multiselect' } }): void => {
    setFieldKeyToEdit(field.key);
    setFieldToEdit({
      label: field.metadata.label,
      value: field.value,
      type: field.metadata.type,
    });
    setIsAddModalVisible(true);
  };

  // Get sorted custom fields
  const customFields = profile ? getCustomFields(profile, profile._fieldsMeta) : [];

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
        logger.error('Failed to open Intercom messenger', { feature: 'ProfileScreen', error: error instanceof Error ? error : new Error(String(error)) });
        showAlert(
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
    <GestureHandlerRootView style={styles.container} testID="profile-container">
      <KeyboardAwareScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent} 
        bottomOffset={KEYBOARD_AWARE_SCROLL_OFFSET}
        testID="profile-scroll-view"
      >
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
          <>
            <View style={styles.yellowCircle} />
            <View style={[styles.header, { paddingTop: topInset + 16 }]} testID="profile-header">
              <Text style={styles.headerTitle} testID="header-title">BossUp</Text>
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
              <InlineEditableHeading
                value={profile.displayName || 'User'}
                onSave={async (newName) => {
                  await updateProfile({ displayName: newName });
                  trackAmplitudeEvent('profile_field_edited', {
                    field: 'displayName',
                  });
                }}
                placeholder="Enter your name"
                testID="username"
                style={styles.username}
              />
              <Text style={styles.email} testID="email-text">{profile.email}</Text>
            </View>

            <View style={styles.fieldsSection} testID="fields-section">
              <View style={styles.goalCard} testID="goal-card">
                <Image 
                  source={require('@/assets/images/flag-icon.png')} 
                  style={styles.cardIcon}
                  resizeMode="contain"
                  testID="goal-flag-icon"
                />
                <View style={styles.cardContent} testID="goal-content">
                  <Text style={styles.cardLabel} testID="goal-label">Your Goal: </Text>
                  <TextInput
                    style={[styles.cardValueInput, { outlineStyle: 'none' } as any]}
                    value={goalValue}
                    onChangeText={setGoalValue}
                    onBlur={handleBlurGoal}
                    placeholder="Enter your goal"
                    placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    testID="goal-input"
                  />
                </View>
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
                  <TextInput
                    style={[styles.cardValueInput, { outlineStyle: 'none' } as any]}
                    value={positionValue}
                    onChangeText={setPositionValue}
                    onBlur={handleBlurPosition}
                    placeholder="Enter your position"
                    placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    testID="position-input"
                  />
                </View>
              </View>

              {/* Render all custom fields dynamically */}
              {customFields.map((field) => (
                <View key={field.key} style={styles.customFieldWrapper}>
                  <SwipeableCustomFieldRow
                    fieldKey={field.key}
                    fieldValue={field.value}
                    metadata={field.metadata}
                    onPress={() => handleEditCustomField(field)}
                    onDelete={handleDeleteCustomField}
                    variant="profile"
                  />
                </View>
              ))}
              
              {/* Add custom field button */}
              <AddCustomFieldButton onPress={() => setIsAddModalVisible(true)} />
            </View>

            {/* TODO: This section uses mocked metrics data. Replace with real calculations based on timeline entries */}
            {/* <View style={styles.metricsSection} testID="metrics-section">
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
            </View> */}

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
          </>
        )}
      </KeyboardAwareScrollView>

      <FloatingChatButton />
      
      {/* Add custom field modal */}
      <AddCustomFieldModal
        isVisible={isAddModalVisible}
        onClose={handleCloseModal}
        onCreateEmpty={fieldKeyToEdit ? undefined : handleCreateEmptyCustomField}
        onUpdate={handleUpdateCustomField}
        fieldKeyToEdit={fieldKeyToEdit || undefined}
        initialLabel={fieldToEdit?.label}
        initialValue={fieldToEdit?.value ? String(fieldToEdit.value) : undefined}
        initialType={fieldToEdit?.type as 'text' | 'multiline' | 'select' | 'date' | 'multiselect' | undefined}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F1E8',
    overflow: 'hidden',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 600,
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
  yellowCircle: {
    position: 'absolute',
    width: 1021,
    height: 1021,
    borderRadius: 510.5,
    backgroundColor: '#FFFFE2',
    top: -650,
    left: '50%',
    marginLeft: -510.5,
    zIndex: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 70,
    flexGrow: 1,
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
    minHeight: 72,
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
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
    marginTop: 32,
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
  fieldsSection: {
    marginBottom: 24,
  },
  customFieldWrapper: {
    marginHorizontal: 12,
  },
});
