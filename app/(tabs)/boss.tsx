import { FloatingChatButton } from '@/components/FloatingChatButton';
import { useBoss } from '@/hooks/useBoss';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { logger } from '@/services/logger.service';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BossScreen() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top;
  
  const { boss, loading, error, updateBoss } = useBoss();
  
  // Editing states for each field
  const [isEditingWorkingHours, setIsEditingWorkingHours] = useState(false);
  const [workingHours, setWorkingHours] = useState('');
  
  const [isEditingBirthday, setIsEditingBirthday] = useState(false);
  const [birthday, setBirthday] = useState('');
  
  const [isEditingPosition, setIsEditingPosition] = useState(false);
  const [position, setPosition] = useState('');
  
  const [isEditingStartedAt, setIsEditingStartedAt] = useState(false);
  const [startedAt, setStartedAt] = useState('');
  
  const [isEditingManagementStyle, setIsEditingManagementStyle] = useState(false);
  const [managementStyle, setManagementStyle] = useState('');
  
  const [isEditingFavoriteColor, setIsEditingFavoriteColor] = useState(false);
  const [favoriteColor, setFavoriteColor] = useState('');
  
  const [isEditingCommunicationPreference, setIsEditingCommunicationPreference] = useState(false);
  const [communicationPreference, setCommunicationPreference] = useState('');
  
  const [isEditingDepartment, setIsEditingDepartment] = useState(false);
  const [department, setDepartment] = useState('');

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

  const handleEditWorkingHours = (): void => {
    setWorkingHours(boss?.workingHours || '');
    setIsEditingWorkingHours(true);
  };

  const handleBlurWorkingHours = async (): Promise<void> => {
    setIsEditingWorkingHours(false);
    if (workingHours !== boss?.workingHours && boss) {
      try {
        await updateBoss({ workingHours });
        trackAmplitudeEvent('boss_field_edited', {
          field: 'workingHours',
          bossId: boss.id,
        });
      } catch (err) {
        logger.error('Failed to update working hours', err instanceof Error ? err : new Error(String(err)), { feature: 'BossScreen', bossId: boss.id });
      }
    }
  };

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
        logger.error('Failed to update birthday', err instanceof Error ? err : new Error(String(err)), { feature: 'BossScreen', bossId: boss.id });
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
        logger.error('Failed to update position', err instanceof Error ? err : new Error(String(err)), { feature: 'BossScreen', bossId: boss.id });
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
        logger.error('Failed to update started at', err instanceof Error ? err : new Error(String(err)), { feature: 'BossScreen', bossId: boss.id });
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
        logger.error('Failed to update management style', err instanceof Error ? err : new Error(String(err)), { feature: 'BossScreen', bossId: boss.id });
      }
    }
  };

  const handleEditFavoriteColor = (): void => {
    setFavoriteColor(boss?.favoriteColor || '');
    setIsEditingFavoriteColor(true);
  };

  const handleBlurFavoriteColor = async (): Promise<void> => {
    setIsEditingFavoriteColor(false);
    if (favoriteColor !== boss?.favoriteColor && boss) {
      try {
        await updateBoss({ favoriteColor });
        trackAmplitudeEvent('boss_field_edited', {
          field: 'favoriteColor',
          bossId: boss.id,
        });
      } catch (err) {
        logger.error('Failed to update favorite color', err instanceof Error ? err : new Error(String(err)), { feature: 'BossScreen', bossId: boss.id });
      }
    }
  };

  const handleEditCommunicationPreference = (): void => {
    setCommunicationPreference(boss?.communicationPreference || '');
    setIsEditingCommunicationPreference(true);
  };

  const handleBlurCommunicationPreference = async (): Promise<void> => {
    setIsEditingCommunicationPreference(false);
    if (communicationPreference !== boss?.communicationPreference && boss) {
      try {
        await updateBoss({ communicationPreference });
        trackAmplitudeEvent('boss_field_edited', {
          field: 'communicationPreference',
          bossId: boss.id,
        });
      } catch (err) {
        logger.error('Failed to update communication preference', err instanceof Error ? err : new Error(String(err)), { feature: 'BossScreen', bossId: boss.id });
      }
    }
  };

  const handleEditDepartment = (): void => {
    setDepartment(boss?.department || '');
    setIsEditingDepartment(true);
  };

  const handleBlurDepartment = async (): Promise<void> => {
    setIsEditingDepartment(false);
    if (department !== boss?.department && boss) {
      try {
        await updateBoss({ department });
        trackAmplitudeEvent('boss_field_edited', {
          field: 'department',
          bossId: boss.id,
        });
      } catch (err) {
        logger.error('Failed to update department', err instanceof Error ? err : new Error(String(err)), { feature: 'BossScreen', bossId: boss.id });
      }
    }
  };

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
          <View style={styles.infoCard} testID="working-hours-card">
            <Text style={styles.cardIcon} testID="working-hours-icon">⏰</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel} testID="working-hours-label">Working hours</Text>
              {isEditingWorkingHours ? (
                <TextInput
                  style={[styles.cardValueInput, { outlineStyle: 'none' } as any]}
                  value={workingHours}
                  onChangeText={setWorkingHours}
                  onBlur={handleBlurWorkingHours}
                  autoFocus
                  placeholder="Enter working hours"
                  testID="working-hours-input"
                />
              ) : (
                <Text style={styles.cardValue} testID="working-hours-value">{boss.workingHours || 'Not set'}</Text>
              )}
            </View>
            {!isEditingWorkingHours && (
              <TouchableOpacity onPress={handleEditWorkingHours} style={styles.cardEditButton} testID="working-hours-edit-button">
                <FontAwesome name="pencil" size={18} color="#333" testID="working-hours-edit-icon" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoCard} testID="birthday-card">
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
                <Text style={styles.cardValue} testID="birthday-value">{boss.birthday || 'Not set'}</Text>
              )}
            </View>
            {!isEditingBirthday && (
              <TouchableOpacity onPress={handleEditBirthday} style={styles.cardEditButton} testID="birthday-edit-button">
                <FontAwesome name="pencil" size={18} color="#333" testID="birthday-edit-icon" />
              </TouchableOpacity>
            )}
          </View>
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
            {!isEditingPosition && (
              <TouchableOpacity onPress={handleEditPosition} style={styles.rowEditButton} testID="position-edit-button">
                <FontAwesome name="pencil" size={16} color="#666" testID="position-edit-icon" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoRow} testID="started-at-row">
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
            {!isEditingStartedAt && (
              <TouchableOpacity onPress={handleEditStartedAt} style={styles.rowEditButton} testID="started-at-edit-button">
                <FontAwesome name="pencil" size={16} color="#666" testID="started-at-edit-icon" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoRow} testID="management-style-row">
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
                <Text style={styles.rowValue} testID="management-style-value">{boss.managementStyle || 'Not set'}</Text>
              )}
            </View>
            {!isEditingManagementStyle && (
              <TouchableOpacity onPress={handleEditManagementStyle} style={styles.rowEditButton} testID="management-style-edit-button">
                <FontAwesome name="pencil" size={16} color="#666" testID="management-style-edit-icon" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoRow} testID="favorite-color-row">
            <Text style={styles.rowIconEmoji} testID="favorite-color-icon">👀</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel} testID="favorite-color-label">Favorite color</Text>
              {isEditingFavoriteColor ? (
                <TextInput
                  style={[styles.rowValueInput, { outlineStyle: 'none' } as any]}
                  value={favoriteColor}
                  onChangeText={setFavoriteColor}
                  onBlur={handleBlurFavoriteColor}
                  autoFocus
                  placeholder="Enter favorite color"
                  testID="favorite-color-input"
                />
              ) : (
                <Text style={styles.rowValue} testID="favorite-color-value">{boss.favoriteColor || 'Not set'}</Text>
              )}
            </View>
            {!isEditingFavoriteColor && (
              <TouchableOpacity onPress={handleEditFavoriteColor} style={styles.rowEditButton} testID="favorite-color-edit-button">
                <FontAwesome name="pencil" size={16} color="#666" testID="favorite-color-edit-icon" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoRow} testID="communication-preference-row">
            <Text style={styles.rowIconEmoji} testID="communication-preference-icon">🗣️</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel} testID="communication-preference-label">Communicative preference</Text>
              {isEditingCommunicationPreference ? (
                <TextInput
                  style={[styles.rowValueInput, { outlineStyle: 'none' } as any]}
                  value={communicationPreference}
                  onChangeText={setCommunicationPreference}
                  onBlur={handleBlurCommunicationPreference}
                  autoFocus
                  placeholder="Enter communication preference"
                  testID="communication-preference-input"
                />
              ) : (
                <Text style={styles.rowValue} testID="communication-preference-value">{boss.communicationPreference || 'Not set'}</Text>
              )}
            </View>
            {!isEditingCommunicationPreference && (
              <TouchableOpacity onPress={handleEditCommunicationPreference} style={styles.rowEditButton} testID="communication-preference-edit-button">
                <FontAwesome name="pencil" size={16} color="#666" testID="communication-preference-edit-icon" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoRow} testID="department-row">
            <Image 
              source={require('@/assets/images/department-icon.png')} 
              style={styles.rowIcon}
              resizeMode="contain"
              testID="department-icon"
            />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel} testID="department-label">Departament</Text>
              {isEditingDepartment ? (
                <TextInput
                  style={[styles.rowValueInput, { outlineStyle: 'none' } as any]}
                  value={department}
                  onChangeText={setDepartment}
                  onBlur={handleBlurDepartment}
                  autoFocus
                  placeholder="Enter department"
                  testID="department-input"
                />
              ) : (
                <Text style={styles.rowValue} testID="department-value">{boss.department}</Text>
              )}
            </View>
            {!isEditingDepartment && (
              <TouchableOpacity onPress={handleEditDepartment} style={styles.rowEditButton} testID="department-edit-button">
                <FontAwesome name="pencil" size={16} color="#666" testID="department-edit-icon" />
              </TouchableOpacity>
            )}
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
    color: '#999',
    marginBottom: 4,
    fontFamily: 'Manrope-Regular',
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Manrope-SemiBold',
  },
  cardValueInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Manrope-SemiBold',
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
    color: '#999',
    marginBottom: 2,
    fontFamily: 'Manrope-Regular',
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Manrope-SemiBold',
  },
  rowValueInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Manrope-SemiBold',
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
