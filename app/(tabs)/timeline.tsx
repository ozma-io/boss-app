import { TimelineItem } from '@/components/timeline/TimelineItem';
import { AppColors } from '@/constants/Colors';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { TimelineEntry } from '@/types';
import { mockBoss, mockTimelineEntries } from '@/utils/mockData';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TimelineScreen() {
  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('timeline_screen_viewed');
    }, [])
  );

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
    <View style={styles.container} testID="timeline-container">
      <View style={styles.headerContainer} testID="header-container">
        <TouchableOpacity
          style={styles.bossHeader}
          onPress={handleBossHeaderPress}
          activeOpacity={0.7}
          testID="boss-header-button"
        >
          <View style={styles.bossInfo} testID="boss-info">
            <Text style={styles.bossName} testID="boss-name">{mockBoss.name}</Text>
            <Text style={styles.bossPosition} testID="boss-position">
              {mockBoss.position}, {mockBoss.department}
            </Text>
            <Text style={styles.bossDetail} testID="boss-detail">
              Meeting: {mockBoss.meetingFrequency}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.timeline} contentContainerStyle={styles.timelineContent} testID="timeline-scroll">
        <Text style={styles.timelineTitle} testID="timeline-title">Timeline</Text>
        {mockTimelineEntries.map((entry) => (
          <TimelineItem
            key={entry.id}
            entry={entry}
            onPress={handleTimelineEntryPress}
            testID={`timeline-item-${entry.id}`}
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
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
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
    fontFamily: 'Manrope-Bold',
  },
  bossPosition: {
    fontSize: 14,
    color: AppColors.textSecondary,
    marginBottom: 2,
    fontFamily: 'Manrope-Regular',
  },
  bossDetail: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Manrope-Regular',
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
    fontFamily: 'Manrope-SemiBold',
  },
});

