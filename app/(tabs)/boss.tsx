import { AddCustomFieldButton } from '@/components/AddCustomFieldButton';
import { AddCustomFieldModal } from '@/components/AddCustomFieldModal';
import { FloatingChatButton } from '@/components/FloatingChatButton';
import { SwipeableCustomFieldRow } from '@/components/SwipeableCustomFieldRow';
import { isBossFieldRequired } from '@/firestore/schemas/field-presets';
import { useBoss } from '@/hooks/useBoss';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { logger } from '@/services/logger.service';
import { showAlert } from '@/utils/alert';
import { sanitizeFieldKey, validateFieldKey } from '@/utils/customFieldHelpers';
import { getCustomFields } from '@/utils/fieldHelpers';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { deleteField } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BossScreen() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top;
  
  const { boss, loading, error, updateBoss } = useBoss();
  
  // Editing states for fixed layout fields
  const [birthday, setBirthday] = useState<Date>(new Date());
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  
  const [isEditingPosition, setIsEditingPosition] = useState(false);
  const [position, setPosition] = useState('');
  
  const [startedAt, setStartedAt] = useState<Date>(new Date());
  const [showStartedAtPicker, setShowStartedAtPicker] = useState(false);
  
  const [isEditingManagementStyle, setIsEditingManagementStyle] = useState(false);
  const [managementStyle, setManagementStyle] = useState('');
  
  // State for custom field management
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);

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

  const handleEditPosition = (): void => {
    setPosition(boss?.position || '');
    setIsEditingPosition(true);
  };

  const handleBlurPosition = async (): Promise<void> => {
    setIsEditingPosition(false);
    if (position !== boss?.position && boss) {
      try {
        await updateBoss({ position });
        trackAmplitudeEvent('boss_field_edited', {
          field: 'position',
          bossId: boss.id,
        });
      } catch (err) {
        logger.error('Failed to update position', { feature: 'BossScreen', bossId: boss.id, error: err instanceof Error ? err : new Error(String(err)) });
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

  const handleEditManagementStyle = (): void => {
    setManagementStyle(boss?.managementStyle || '');
    setIsEditingManagementStyle(true);
  };

  const handleBlurManagementStyle = async (): Promise<void> => {
    setIsEditingManagementStyle(false);
    if (managementStyle !== boss?.managementStyle && boss) {
      try {
        await updateBoss({ managementStyle });
        trackAmplitudeEvent('boss_field_edited', {
          field: 'managementStyle',
          bossId: boss.id,
        });
      } catch (err) {
        logger.error('Failed to update management style', { feature: 'BossScreen', bossId: boss.id, error: err instanceof Error ? err : new Error(String(err)) });
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

  // Handler for adding custom field
  const handleAddCustomField = async (
    label: string,
    type: 'text' | 'multiline' | 'select' | 'date',
    initialValue: string
  ): Promise<void> => {
    if (!boss) return;

    const fieldKey = `custom_${sanitizeFieldKey(label)}`;

    // Check if field already exists
    if (!validateFieldKey(boss, fieldKey)) {
      showAlert('Error', 'A field with this name already exists');
      throw new Error('Field already exists');
    }

    try {
      await updateBoss({
        [fieldKey]: initialValue || '',
        [`_fieldsMeta.${fieldKey}`]: {
          label,
          type,
          source: 'user_added',
          createdAt: new Date().toISOString(),
          displayOrder: Object.keys(boss._fieldsMeta || {}).length,
        },
      });

      trackAmplitudeEvent('boss_custom_field_added', {
        fieldKey,
        type,
        bossId: boss.id,
      });

      logger.info('Custom field added', {
        feature: 'BossScreen',
        bossId: boss.id,
        fieldKey,
        type,
      });
    } catch (err) {
      logger.error('Failed to add custom field', {
        feature: 'BossScreen',
        bossId: boss.id,
        fieldKey,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    }
  };

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

  // Get sorted custom fields
  const customFields = boss ? getCustomFields(boss, boss._fieldsMeta) : [];

  return (
    <GestureHandlerRootView style={styles.container}>
      {loading ? (
        <View style={[styles.centerContent, { flex: 1 }]} testID="boss-loading">
          <ActivityIndicator size="large" color="#B6D95C" />
          <Text style={styles.loadingText}>Loading boss data...</Text>
        </View>
      ) : error ? (
        <View style={[styles.centerContent, { flex: 1 }]} testID="boss-error">
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>Please check your connection or try again later.</Text>
        </View>
      ) : !boss ? (
        <View style={[styles.centerContent, { flex: 1 }]} testID="boss-empty">
          <Text style={styles.emptyIcon}>👤</Text>
          <Text style={styles.emptyText}>No boss found</Text>
          <Text style={styles.emptyHint}>Add a boss to get started</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} testID="boss-scroll">
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
          <Text style={styles.bossName} testID="boss-name">{boss.name}</Text>
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

          <Pressable 
            style={styles.infoRow} 
            testID="position-row"
            onPress={isEditingPosition ? undefined : handleEditPosition}
          >
            <Image 
              source={require('@/assets/images/briefcase-icon.png')} 
              style={styles.rowIcon}
              resizeMode="contain"
              testID="position-icon"
            />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel} testID="position-label">Position</Text>
              {isEditingPosition ? (
                <TextInput
                  style={[styles.rowValueInput, { outlineStyle: 'none' } as any]}
                  value={position}
                  onChangeText={setPosition}
                  onBlur={handleBlurPosition}
                  autoFocus
                  placeholder="Enter position"
                  testID="position-input"
                />
              ) : (
                <Text style={styles.rowValue} testID="position-value">{boss.position}</Text>
              )}
            </View>
          </Pressable>

          <Pressable 
            style={styles.infoRow} 
            testID="management-style-row"
            onPress={isEditingManagementStyle ? undefined : handleEditManagementStyle}
          >
            <Text style={styles.rowIconEmoji} testID="management-style-icon">🤝</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel} testID="management-style-label">Management style</Text>
              {isEditingManagementStyle ? (
                <TextInput
                  style={[styles.rowValueInput, { outlineStyle: 'none' } as any]}
                  value={managementStyle}
                  onChangeText={setManagementStyle}
                  onBlur={handleBlurManagementStyle}
                  autoFocus
                  placeholder="Enter management style"
                  testID="management-style-input"
                />
              ) : (
                <Text style={[styles.rowValue, !boss.managementStyle && { opacity: 0.5 }]} testID="management-style-value">{boss.managementStyle || 'Not set'}</Text>
              )}
            </View>
          </Pressable>

          {/* Render all custom fields dynamically */}
          {customFields.map((field) => (
            <SwipeableCustomFieldRow
              key={field.key}
              fieldKey={field.key}
              fieldValue={field.value}
              metadata={field.metadata}
              onUpdate={handleCustomFieldUpdate}
              onDelete={handleDeleteCustomField}
              variant="boss"
            />
          ))}
          
          {/* Add custom field button */}
          <AddCustomFieldButton onPress={() => setIsAddModalVisible(true)} />
        </View>
      </ScrollView>
      )}

      {/* Date Picker for Started At */}
      {showStartedAtPicker && (
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => setShowStartedAtPicker(false)}
          testID="started-at-picker-overlay"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            testID="started-at-picker-container"
          >
            <DateTimePicker
              value={startedAt}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleStartedAtChange}
              testID="started-at-date-picker"
            />
          </Pressable>
        </Pressable>
      )}

      {/* Date Picker for Birthday */}
      {showBirthdayPicker && (
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => setShowBirthdayPicker(false)}
          testID="birthday-picker-overlay"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            testID="birthday-picker-container"
          >
            <DateTimePicker
              value={birthday}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleBirthdayChange}
              testID="birthday-date-picker"
            />
          </Pressable>
        </Pressable>
      )}

      <FloatingChatButton />
      
      {/* Add custom field modal */}
      <AddCustomFieldModal
        isVisible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onAdd={handleAddCustomField}
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
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
