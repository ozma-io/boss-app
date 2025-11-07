import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/auth.service';
import { mockUserGoal, mockUserMetrics, mockUserProfile } from '@/utils/mockData';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function MainScreen() {
  const { user } = useAuth();
  const [goalDescription, setGoalDescription] = useState(mockUserGoal.description);
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  const handleSignOut = async (): Promise<void> => {
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

  const handleSaveGoal = (): void => {
    setIsEditingGoal(false);
    // TODO: Save goal to backend
  };

  const handleCancelEditGoal = (): void => {
    setGoalDescription(mockUserGoal.description);
    setIsEditingGoal(false);
  };

  const handleOpenChat = (): void => {
    router.push('/chat');
  };

  const handleOpenBossTimeline = (): void => {
    router.push('/boss-timeline');
  };

  const handleOpenPersonalInfo = (): void => {
    router.push('/personal-info');
  };

  const handleOpenSubscription = (): void => {
    router.push('/subscription');
  };

  const handleOpenSupport = (): void => {
    router.push('/support');
  };

  const renderProgressBar = (value: number, color: string) => {
    return (
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${value * 100}%`, backgroundColor: color }]} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>The Boss App</Text>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>👤</Text>
          </View>
          <Text style={styles.username}>{mockUserProfile.username}</Text>
          <Text style={styles.email}>{user?.email || mockUserProfile.email}</Text>
        </View>

        {/* Temporarily commented out Boss Timeline button */}
        {/* <TouchableOpacity
          style={styles.bossTimelineButton}
          onPress={handleOpenBossTimeline}
          activeOpacity={0.7}
        >
          <FontAwesome name="briefcase" size={20} color="#333" />
          <Text style={styles.bossTimelineButtonText}>Boss Timeline</Text>
          <FontAwesome name="chevron-right" size={16} color="#666" />
        </TouchableOpacity> */}

        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <View style={styles.goalTitleContainer}>
              <FontAwesome name="flag" size={20} color="#333" />
              <Text style={styles.goalTitle}>{mockUserGoal.title}</Text>
            </View>
            {!isEditingGoal && (
              <TouchableOpacity onPress={handleEditGoal} style={styles.editButton}>
                <FontAwesome name="pencil" size={18} color="#333" />
              </TouchableOpacity>
            )}
          </View>
          {isEditingGoal ? (
            <>
              <TextInput
                style={styles.goalInput}
                value={goalDescription}
                onChangeText={setGoalDescription}
                multiline
                autoFocus
                placeholder="Enter your goal"
              />
              <View style={styles.goalEditButtons}>
                <TouchableOpacity onPress={handleCancelEditGoal} style={styles.goalCancelButton}>
                  <Text style={styles.goalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveGoal} style={styles.goalSaveButton}>
                  <Text style={styles.goalSaveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={styles.goalDescription}>{goalDescription}</Text>
          )}
        </View>

        <View style={styles.metricsSection}>
          <Text style={styles.sectionTitle}>Where You Now</Text>

          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Your stress level</Text>
              <Text style={styles.metricValue}>Higher than {Math.round(mockUserMetrics.stressLevel * 100)}%</Text>
            </View>
            {renderProgressBar(mockUserMetrics.stressLevel, '#B8E986')}
          </View>

          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Boss relationship challenges</Text>
              <Text style={styles.metricValue}>More than {Math.round(mockUserMetrics.bossRelationshipChallenges * 100)}%</Text>
            </View>
            {renderProgressBar(mockUserMetrics.bossRelationshipChallenges, '#FF6B6B')}
          </View>

          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Self-doubt / confidence gap</Text>
              <Text style={styles.metricValue}>Higher than {Math.round(mockUserMetrics.selfDoubtConfidenceGap * 100)}%</Text>
            </View>
            {renderProgressBar(mockUserMetrics.selfDoubtConfidenceGap, '#B8E986')}
          </View>
        </View>

        <View style={styles.settingsSectionContainer}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingsSection}>
            <Pressable
              style={({ pressed }) => [
                styles.settingsItem,
                pressed && styles.settingsItemPressed
              ]}
              onPress={handleOpenPersonalInfo}
            >
              <Text style={styles.settingsItemText}>Personal information</Text>
              <FontAwesome name="chevron-right" size={16} color="#666" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.settingsItem,
                pressed && styles.settingsItemPressed
              ]}
              onPress={handleOpenSubscription}
            >
              <Text style={styles.settingsItemText}>Subscription</Text>
              <FontAwesome name="chevron-right" size={16} color="#666" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.settingsItem,
                pressed && styles.settingsItemPressed
              ]}
              onPress={handleOpenSupport}
            >
              <Text style={styles.settingsItemText}>Support</Text>
              <FontAwesome name="chevron-right" size={16} color="#666" />
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable onPress={handleSignOut}>
            <Text style={styles.footerLink}>Privacy policy</Text>
          </Pressable>
          <Pressable onPress={handleSignOut}>
            <Text style={styles.footerLink}>Terms of service</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.signOutButtonPressed
          ]}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutButtonText}>Sign out</Text>
          <FontAwesome name="sign-out" size={18} color="#333" />
        </Pressable>
      </ScrollView>

      <TouchableOpacity
        style={styles.chatButton}
        onPress={handleOpenChat}
        activeOpacity={0.8}
      >
        <FontAwesome name="comment" size={24} color="#333" />
      </TouchableOpacity>
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
    paddingTop: 60,
    paddingBottom: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8A87C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatar: {
    fontSize: 40,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
  },
  bossTimelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bossTimelineButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginLeft: 12,
  },
  goalCard: {
    backgroundColor: '#B8E986',
    marginHorizontal: 12,
    marginBottom: 24,
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
  },
  editButton: {
    padding: 4,
  },
  goalDescription: {
    fontSize: 16,
    color: '#333',
  },
  goalInput: {
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  goalEditButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  goalCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  goalCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  goalSaveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  goalSaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B8E986',
  },
  metricsSection: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
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
  },
  metricValue: {
    fontSize: 14,
    color: '#666',
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
  },
  footer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  footerLink: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  signOutButtonPressed: {
    opacity: 0.7,
  },
  chatButton: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#B8E986',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
});
