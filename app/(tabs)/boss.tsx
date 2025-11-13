import { CustomFieldRow } from '@/components/CustomFieldRow';
import { FloatingChatButton } from '@/components/FloatingChatButton';
import { useBoss } from '@/hooks/useBoss';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { logger } from '@/services/logger.service';
import { getCustomFields } from '@/utils/fieldHelpers';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BossScreen() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top;
  
  const { boss, loading, error, updateBoss } = useBoss();
  
  // Editing states for fixed layout fields
  const [isEditingBirthday, setIsEditingBirthday] = useState(false);
  const [birthday, setBirthday] = useState('');
  
  const [isEditingPosition, setIsEditingPosition] = useState(false);
  const [position, setPosition] = useState('');
  
  const [isEditingStartedAt, setIsEditingStartedAt] = useState(false);
  const [startedAt, setStartedAt] = useState('');
  
  const [isEditingManagementStyle, setIsEditingManagementStyle] = useState(false);
  const [managementStyle, setManagementStyle] = useState('');

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
    setBirthday(boss?.birthday || '');
    setIsEditingBirthday(true);
  };

  const handleBlurBirthday = async (): Promise<void> => {
    setIsEditingBirthday(false);
    if (birthday !== boss?.birthday && boss) {
      try {
        await updateBoss({ birthday });
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
    setStartedAt(boss?.startedAt || '');
    setIsEditingStartedAt(true);
  };

  const handleBlurStartedAt = async (): Promise<void> => {
    setIsEditingStartedAt(false);
    if (startedAt !== boss?.startedAt && boss) {
      try {
        await updateBoss({ startedAt });
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

  // Get sorted custom fields
  const customFields = boss ? getCustomFields(boss, boss._fieldsMeta) : [];

  return (
    <View style={styles.container}>
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
          <Text style={styles.headerTitle} testID="header-title">The Boss App</Text>
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
            testID="management-style-card"
            onPress={isEditingManagementStyle ? undefined : handleEditManagementStyle}
          >
            <Text style={styles.cardIcon} testID="management-style-icon">🤝</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel} testID="management-style-label">Management style</Text>
              {isEditingManagementStyle ? (
                <TextInput
                  style={[styles.cardValueInput, { outlineStyle: 'none' } as any]}
                  value={managementStyle}
                  onChangeText={setManagementStyle}
                  onBlur={handleBlurManagementStyle}
                  autoFocus
                  placeholder="Enter management style"
                  testID="management-style-input"
                />
              ) : (
                <Text style={[styles.cardValue, !boss.managementStyle && { opacity: 0.5 }]} testID="management-style-value">{boss.managementStyle || 'Not set'}</Text>
              )}
            </View>
          </Pressable>

          <Pressable 
            style={styles.infoCard} 
            testID="birthday-card"
            onPress={isEditingBirthday ? undefined : handleEditBirthday}
          >
            <Text style={styles.cardIcon} testID="birthday-icon">🎂</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel} testID="birthday-label">Birthday</Text>
              {isEditingBirthday ? (
                <TextInput
                  style={[styles.cardValueInput, { outlineStyle: 'none' } as any]}
                  value={birthday}
                  onChangeText={setBirthday}
                  onBlur={handleBlurBirthday}
                  autoFocus
                  placeholder="Enter birthday"
                  testID="birthday-input"
                />
              ) : (
                <Text style={[styles.cardValue, !boss.birthday && { opacity: 0.5 }]} testID="birthday-value">{boss.birthday || 'Not set'}</Text>
              )}
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
            testID="started-at-row"
            onPress={isEditingStartedAt ? undefined : handleEditStartedAt}
          >
            <Text style={styles.rowIconEmoji} testID="started-at-icon">📅</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel} testID="started-at-label">Started at</Text>
              {isEditingStartedAt ? (
                <TextInput
                  style={[styles.rowValueInput, { outlineStyle: 'none' } as any]}
                  value={startedAt}
                  onChangeText={setStartedAt}
                  onBlur={handleBlurStartedAt}
                  autoFocus
                  placeholder="Enter started date"
                  testID="started-at-input"
                />
              ) : (
                <Text style={styles.rowValue} testID="started-at-value">{boss.startedAt}</Text>
              )}
            </View>
          </Pressable>

          {/* Render all custom fields dynamically */}
          {customFields.map((field) => (
            <CustomFieldRow
              key={field.key}
              fieldKey={field.key}
              fieldValue={field.value}
              metadata={field.metadata}
              onUpdate={handleCustomFieldUpdate}
              variant="boss"
            />
          ))}
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
});
