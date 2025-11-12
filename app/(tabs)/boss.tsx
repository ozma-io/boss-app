import { FloatingChatButton } from '@/components/FloatingChatButton';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { mockBoss } from '@/utils/mockData';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BossScreen() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top;

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('boss_screen_viewed');
    }, [])
  );

  return (
    <View style={styles.container}>
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
          <Text style={styles.bossName} testID="boss-name">{mockBoss.name}</Text>
        </View>

        <View style={styles.cardsRow} testID="cards-row">
          <View style={styles.infoCard} testID="working-hours-card">
            <Text style={styles.cardIcon} testID="working-hours-icon">⏰</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel} testID="working-hours-label">Working hours</Text>
              <Text style={styles.cardValue} testID="working-hours-value">{mockBoss.workingHours}</Text>
            </View>
          </View>

          <View style={styles.infoCard} testID="birthday-card">
            <Text style={styles.cardIcon} testID="birthday-icon">🎂</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel} testID="birthday-label">Birthday</Text>
              <Text style={styles.cardValue} testID="birthday-value">{mockBoss.birthday}</Text>
            </View>
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
              <Text style={styles.rowValue} testID="position-value">{mockBoss.position}</Text>
            </View>
          </View>

          <View style={styles.infoRow} testID="started-at-row">
            <Text style={styles.rowIconEmoji} testID="started-at-icon">📅</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel} testID="started-at-label">Started at</Text>
              <Text style={styles.rowValue} testID="started-at-value">{mockBoss.startedAt}</Text>
            </View>
          </View>

          <View style={styles.infoRow} testID="management-style-row">
            <Text style={styles.rowIconEmoji} testID="management-style-icon">🤝</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel} testID="management-style-label">Management style</Text>
              <Text style={styles.rowValue} testID="management-style-value">{mockBoss.managementStyle}</Text>
            </View>
          </View>

          <View style={styles.infoRow} testID="favorite-color-row">
            <Text style={styles.rowIconEmoji} testID="favorite-color-icon">👀</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel} testID="favorite-color-label">Favorite color</Text>
              <Text style={styles.rowValue} testID="favorite-color-value">{mockBoss.favoriteColor}</Text>
            </View>
          </View>

          <View style={styles.infoRow} testID="communication-preference-row">
            <Text style={styles.rowIconEmoji} testID="communication-preference-icon">🗣️</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel} testID="communication-preference-label">Communicative preference</Text>
              <Text style={styles.rowValue} testID="communication-preference-value">{mockBoss.communicationPreference}</Text>
            </View>
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
              <Text style={styles.rowValue} testID="department-value">{mockBoss.department}</Text>
            </View>
          </View>
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
    overflow: 'hidden',
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
    paddingBottom: 100,
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
});

