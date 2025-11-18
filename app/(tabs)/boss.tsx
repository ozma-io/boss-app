import { AddCustomFieldButton } from '@/components/AddCustomFieldButton';
import { AddCustomFieldModal } from '@/components/AddCustomFieldModal';
import { DateTimePickerModal } from '@/components/DateTimePickerModal';
import { FloatingChatButton } from '@/components/FloatingChatButton';
import { InlineEditableHeading } from '@/components/InlineEditableHeading';
import { SwipeableCustomFieldRow } from '@/components/SwipeableCustomFieldRow';
import { isBossFieldRequired } from '@/firestore/schemas/field-presets';
import { useBoss } from '@/hooks/useBoss';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { logger } from '@/services/logger.service';
import { showAlert } from '@/utils/alert';
import { generateUniqueFieldKey } from '@/utils/customFieldHelpers';
import { getCustomFields } from '@/utils/fieldHelpers';
import { useFocusEffect } from 'expo-router';
import { deleteField } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BossScreen() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top;
  
  const { boss, loading, error, updateBoss } = useBoss();
  
  // Editing states for fixed layout fields
  const [birthday, setBirthday] = useState<Date>(new Date());
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  
  const [positionValue, setPositionValue] = useState('');
  
  const [startedAt, setStartedAt] = useState<Date>(new Date());
  const [showStartedAtPicker, setShowStartedAtPicker] = useState(false);
  
  const [managementStyleValue, setManagementStyleValue] = useState('');
  
  // State for custom field management
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [fieldKeyToEdit, setFieldKeyToEdit] = useState<string | null>(null);
  const [fieldToEdit, setFieldToEdit] = useState<{label: string; value: any; type: 'text' | 'multiline' | 'select' | 'date' | 'multiselect'} | null>(null);

  // Ref to always access latest boss value without affecting callback dependencies
  const bossRef = useRef(boss);
  useEffect(() => {
    bossRef.current = boss;
  }, [boss]);

  // Sync local state with boss data
  useEffect(() => {
    if (boss) {
      setPositionValue(boss.position || '');
      setManagementStyleValue(boss.managementStyle || '');
    }
  }, [boss]);

  const handleCloseModal = useCallback((): void => {
    setIsAddModalVisible(false);
    setFieldKeyToEdit(null);
    setFieldToEdit(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('boss_screen_viewed');
      
      if (boss) {
        trackAmplitudeEvent('boss_data_loaded', {
          bossId: boss.id,
          bossName: boss.name,
        });
      }
    }, [boss])
  );

  const handleEditBirthday = (): void => {
    setShowStartedAtPicker(false);
    if (boss?.birthday) {
      setBirthday(new Date(boss.birthday));
    } else {
      setBirthday(new Date());
    }
    setShowBirthdayPicker(true);
  };

  const handleBirthdayChange = async (event: any, selectedDate?: Date): Promise<void> => {
    if (selectedDate && boss) {
      setBirthday(selectedDate);
      try {
        await updateBoss({ birthday: selectedDate.toISOString() });
        trackAmplitudeEvent('boss_field_edited', {
          field: 'birthday',
          bossId: boss.id,
        });
      } catch (err) {
        logger.error('Failed to update birthday', { feature: 'BossScreen', bossId: boss.id, error: err instanceof Error ? err : new Error(String(err)) });
      }
    }
  };

  const handleBlurPosition = async (): Promise<void> => {
    if (positionValue !== boss?.position && boss) {
      try {
        await updateBoss({ position: positionValue });
        trackAmplitudeEvent('boss_field_edited', {
          field: 'position',
          bossId: boss.id,
        });
      } catch (err) {
        logger.error('Failed to update position', { feature: 'BossScreen', bossId: boss.id, error: err instanceof Error ? err : new Error(String(err)) });
        // Revert to original value on error
        setPositionValue(boss?.position || '');
      }
    }
  };

  const handleEditStartedAt = (): void => {
    setShowBirthdayPicker(false);
    if (boss?.startedAt) {
      setStartedAt(new Date(boss.startedAt));
    } else {
      setStartedAt(new Date());
    }
    setShowStartedAtPicker(true);
  };

  const handleStartedAtChange = async (event: any, selectedDate?: Date): Promise<void> => {
    if (selectedDate && boss) {
      setStartedAt(selectedDate);
      try {
        await updateBoss({ startedAt: selectedDate.toISOString() });
        trackAmplitudeEvent('boss_field_edited', {
          field: 'startedAt',
          bossId: boss.id,
        });
      } catch (err) {
        logger.error('Failed to update started at', { feature: 'BossScreen', bossId: boss.id, error: err instanceof Error ? err : new Error(String(err)) });
      }
    }
  };

  const handleBlurManagementStyle = async (): Promise<void> => {
    if (managementStyleValue !== boss?.managementStyle && boss) {
      try {
        await updateBoss({ managementStyle: managementStyleValue });
        trackAmplitudeEvent('boss_field_edited', {
          field: 'managementStyle',
          bossId: boss.id,
        });
      } catch (err) {
        logger.error('Failed to update management style', { feature: 'BossScreen', bossId: boss.id, error: err instanceof Error ? err : new Error(String(err)) });
        // Revert to original value on error
        setManagementStyleValue(boss?.managementStyle || '');
      }
    }
  };

  // Handler for custom fields
  const handleCustomFieldUpdate = async (fieldKey: string, value: any): Promise<void> => {
    if (!boss) return;
    
    try {
      await updateBoss({ [fieldKey]: value });
      trackAmplitudeEvent('boss_field_edited', {
        field: fieldKey,
        bossId: boss.id,
      });
    } catch (err) {
      logger.error('Failed to update custom field', { feature: 'BossScreen', bossId: boss.id, fieldKey, error: err instanceof Error ? err : new Error(String(err)) });
    }
  };

  // Handler for creating empty custom field
  const handleCreateEmptyCustomField = useCallback(async (): Promise<string> => {
    const currentBoss = bossRef.current;
    if (!currentBoss) {
      throw new Error('Boss not loaded');
    }

    const fieldKey = generateUniqueFieldKey(currentBoss);

    try {
      await updateBoss({
        [fieldKey]: '',
        [`_fieldsMeta.${fieldKey}`]: {
          label: '',
          type: 'text',
          source: 'user_added',
          createdAt: new Date().toISOString(),
          displayOrder: Object.keys(currentBoss._fieldsMeta || {}).length,
        },
      });

      trackAmplitudeEvent('boss_custom_field_added', {
        fieldKey,
        type: 'text',
        bossId: currentBoss.id,
      });

      logger.info('Empty custom field created', {
        feature: 'BossScreen',
        bossId: currentBoss.id,
        fieldKey,
      });

      return fieldKey;
    } catch (err) {
      logger.error('Failed to create empty custom field', {
        feature: 'BossScreen',
        bossId: currentBoss.id,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    }
  }, [updateBoss]);

  // Handler for updating custom field metadata (label, type) or value
  const handleUpdateCustomField = useCallback(async (
    fieldKey: string,
    updates: { label?: string; type?: 'text' | 'multiline' | 'select' | 'date' | 'multiselect'; value?: string }
  ): Promise<void> => {
    const currentBoss = bossRef.current;
    if (!currentBoss) return;

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

      await updateBoss(updatePayload);

      logger.debug('Custom field updated', {
        feature: 'BossScreen',
        bossId: currentBoss.id,
        fieldKey,
        updates,
      });
    } catch (err) {
      logger.error('Failed to update custom field', {
        feature: 'BossScreen',
        bossId: currentBoss.id,
        fieldKey,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    }
  }, [updateBoss]);

  // Handler for deleting custom field
  const handleDeleteCustomField = (fieldKey: string): void => {
    if (!boss) return;

    // Check if field can be deleted
    if (isBossFieldRequired(fieldKey)) {
      showAlert('Error', 'Cannot delete required field');
      return;
    }

    const fieldLabel = boss._fieldsMeta?.[fieldKey]?.label || fieldKey;

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
              await updateBoss({
                [fieldKey]: deleteField(),
                [`_fieldsMeta.${fieldKey}`]: deleteField(),
              });

              trackAmplitudeEvent('boss_custom_field_deleted', {
                fieldKey,
                bossId: boss.id,
              });

              logger.info('Custom field deleted', {
                feature: 'BossScreen',
                bossId: boss.id,
                fieldKey,
              });
            } catch (err) {
              logger.error('Failed to delete custom field', {
                feature: 'BossScreen',
                bossId: boss.id,
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
  const customFields = boss ? getCustomFields(boss, boss._fieldsMeta) : [];

  return (
    <GestureHandlerRootView style={styles.container}>
      <KeyboardAwareScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent} 
        bottomOffset={150} 
        extraKeyboardSpace={50}
        testID="boss-scroll"
      >
        {loading ? (
          <View style={styles.centerContent} testID="boss-loading">
            <ActivityIndicator size="large" color="#B6D95C" />
            <Text style={styles.loadingText}>Loading boss data...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContent} testID="boss-error">
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>Please check your connection or try again later.</Text>
          </View>
        ) : !boss ? (
          <View style={styles.centerContent} testID="boss-empty">
            <Text style={styles.emptyIcon}>👤</Text>
            <Text style={styles.emptyText}>No boss found</Text>
            <Text style={styles.emptyHint}>Add a boss to get started</Text>
          </View>
        ) : (
          <>
            <View style={styles.greenCircle} />
            <View style={[styles.header, { paddingTop: topInset + 16 }]} testID="boss-header">
              <Text style={styles.headerTitle} testID="header-title">BossUp</Text>
            </View>

            <View style={styles.profileSection} testID="profile-section">
              <View style={styles.avatarContainer} testID="avatar-container">
                <Image 
                  source={require('@/assets/images/boss-avatar.png')} 
                  style={styles.avatar}
                  resizeMode="contain"
                  testID="boss-avatar-image"
                />
              </View>
              <InlineEditableHeading
                value={boss.name}
                onSave={async (newName) => {
                  await updateBoss({ name: newName });
                  trackAmplitudeEvent('boss_field_edited', {
                    field: 'name',
                    bossId: boss.id,
                  });
                }}
                placeholder="Enter boss name"
                testID="boss-name"
                style={styles.bossName}
              />
            </View>

            <View style={styles.cardsRow} testID="cards-row">
              <Pressable 
                style={styles.infoCard} 
                testID="started-at-card"
                onPress={handleEditStartedAt}
              >
                <Text style={styles.cardIcon} testID="started-at-icon">📅</Text>
                <View style={styles.cardContent}>
                  <Text style={styles.cardLabel} testID="started-at-label">Started at</Text>
                  <Text style={[styles.cardValue, !boss.startedAt && { opacity: 0.5 }]} testID="started-at-value">
                    {boss.startedAt ? new Date(boss.startedAt).toLocaleDateString() : 'Not set'}
                  </Text>
                </View>
              </Pressable>

              <Pressable 
                style={styles.infoCard} 
                testID="birthday-card"
                onPress={handleEditBirthday}
              >
                <Text style={styles.cardIcon} testID="birthday-icon">🎂</Text>
                <View style={styles.cardContent}>
                  <Text style={styles.cardLabel} testID="birthday-label">Birthday</Text>
                  <Text style={[styles.cardValue, !boss.birthday && { opacity: 0.5 }]} testID="birthday-value">
                    {boss.birthday ? new Date(boss.birthday).toLocaleDateString() : 'Not set'}
                  </Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.otherInfoSection} testID="other-info-section">
              <Text style={styles.sectionTitle} testID="section-title">Other information</Text>

              <View style={styles.infoRow} testID="position-row">
                <Image 
                  source={require('@/assets/images/briefcase-icon.png')} 
                  style={styles.rowIcon}
                  resizeMode="contain"
                  testID="position-icon"
                />
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel} testID="position-label">Position</Text>
                  <TextInput
                    style={[styles.rowValueInput, { outlineStyle: 'none' } as any]}
                    value={positionValue}
                    onChangeText={setPositionValue}
                    onBlur={handleBlurPosition}
                    placeholder="Enter position"
                    placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    testID="position-input"
                  />
                </View>
              </View>

              <View style={styles.infoRow} testID="management-style-row">
                <Text style={styles.rowIconEmoji} testID="management-style-icon">🤝</Text>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel} testID="management-style-label">Management style</Text>
                  <TextInput
                    style={[styles.rowValueInput, { outlineStyle: 'none' } as any]}
                    value={managementStyleValue}
                    onChangeText={setManagementStyleValue}
                    onBlur={handleBlurManagementStyle}
                    placeholder="Enter management style"
                    placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    testID="management-style-input"
                  />
                </View>
              </View>

              {/* Render all custom fields dynamically */}
              {customFields.map((field) => (
                <SwipeableCustomFieldRow
                  key={field.key}
                  fieldKey={field.key}
                  fieldValue={field.value}
                  metadata={field.metadata}
                  onPress={() => handleEditCustomField(field)}
                  onDelete={handleDeleteCustomField}
                  variant="boss"
                />
              ))}
              
              {/* Add custom field button */}
              <AddCustomFieldButton onPress={() => setIsAddModalVisible(true)} />
            </View>
          </>
        )}
      </KeyboardAwareScrollView>

      {/* Date Picker for Started At */}
      <DateTimePickerModal
        isVisible={showStartedAtPicker}
        value={startedAt}
        mode="date"
        onChange={handleStartedAtChange}
        onClose={() => setShowStartedAtPicker(false)}
        testID="started-at-date-picker"
      />

      {/* Date Picker for Birthday */}
      <DateTimePickerModal
        isVisible={showBirthdayPicker}
        value={birthday}
        mode="date"
        onChange={handleBirthdayChange}
        onClose={() => setShowBirthdayPicker(false)}
        testID="birthday-date-picker"
      />

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
  greenCircle: {
    position: 'absolute',
    width: 1021,
    height: 1021,
    borderRadius: 510.5,
    backgroundColor: '#B6D95C',
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
    overflow: 'visible',
    flexGrow: 1,
  },
  header: {
    paddingBottom: 16,
    alignItems: 'center',
    zIndex: 1,
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
    zIndex: 1,
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
  bossName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'Manrope-Bold',
  },
  cardsRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 24,
    gap: 8,
    zIndex: 1,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'column',
    alignItems: 'flex-start',
    minHeight: 72,
  },
  cardIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  cardContent: {
    flex: 1,
    width: '100%',
  },
  cardLabel: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.4)',
    marginBottom: 4,
    fontFamily: 'Manrope-Regular',
  },
  cardValue: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Manrope-Regular',
  },
  cardValueInput: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Manrope-Regular',
    padding: 0,
    margin: 0,
    borderWidth: 0,
  },
  cardEditButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otherInfoSection: {
    marginHorizontal: 12,
    marginBottom: 24,
    zIndex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    fontFamily: 'Manrope-Bold',
  },
  infoRow: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
  },
  rowIcon: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  rowIconEmoji: {
    fontSize: 24,
    marginRight: 12,
    width: 32,
    textAlign: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.4)',
    marginBottom: 2,
    fontFamily: 'Manrope-Regular',
  },
  rowValue: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Manrope-Regular',
  },
  rowValueInput: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Manrope-Regular',
    padding: 0,
    margin: 0,
    borderWidth: 0,
  },
  rowEditButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
