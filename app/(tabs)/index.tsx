import { TimelineItem } from '@/components/timeline/TimelineItem';
import { AppColors } from '@/constants/Colors';
import { TimelineEntry } from '@/types';
import { mockBoss, mockTimelineEntries } from '@/utils/mockData';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function BossScreen() {
  const handleBossHeaderPress = (): void => {
    router.push('/boss-details');
  };

  const handleTimelineEntryPress = (entry: TimelineEntry): void => {
    router.push({
      pathname: '/entry-details',
      params: { entryId: entry.id },
    });
  };

  return (
    <View style={styles.container}>
      {/* Boss Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.bossHeader}
          onPress={handleBossHeaderPress}
          activeOpacity={0.7}
        >
          <View style={styles.bossInfo}>
            <Text style={styles.bossName}>{mockBoss.name}</Text>
            <Text style={styles.bossPosition}>
              {mockBoss.position}, {mockBoss.department}
            </Text>
            <Text style={styles.bossDetail}>
              Meeting: {mockBoss.meetingFrequency}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Timeline */}
      <ScrollView style={styles.timeline} contentContainerStyle={styles.timelineContent}>
        <Text style={styles.timelineTitle}>Timeline</Text>
        {mockTimelineEntries.map((entry) => (
          <TimelineItem
            key={entry.id}
            entry={entry}
            onPress={handleTimelineEntryPress}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  headerContainer: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bossHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bossInfo: {
    flex: 1,
  },
  bossName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  bossPosition: {
    fontSize: 14,
    color: AppColors.textSecondary,
    marginBottom: 2,
  },
  bossDetail: {
    fontSize: 12,
    color: '#999',
  },
  timeline: {
    flex: 1,
  },
  timelineContent: {
    padding: 16,
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
});
