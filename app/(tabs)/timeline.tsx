import { FloatingChatButton } from '@/components/FloatingChatButton';
import { TimelineItem } from '@/components/timeline/TimelineItem';
import { AppColors } from '@/constants/Colors';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { TimelineEntry } from '@/types';
import { mockTimelineEntries } from '@/utils/mockData';
import { groupTimelineEntries } from '@/utils/timelineHelpers';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function TimelineScreen() {
  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('timeline_screen_viewed');
    }, [])
  );

  const timelineGroups = groupTimelineEntries(mockTimelineEntries);

  const handleTimelineEntryPress = (entry: TimelineEntry): void => {
    router.push({
      pathname: '/entry-details',
      params: { entryId: entry.id },
    });
  };

  return (
    <View style={styles.container} testID="timeline-container">
      <ScrollView style={styles.timeline} contentContainerStyle={styles.timelineContent} testID="timeline-scroll">
        <Text style={styles.timelineTitle} testID="timeline-title">The Boss App</Text>
        {timelineGroups.map((group, groupIndex) => (
          <View key={group.title} style={styles.timelineGroup}>
            <Text style={styles.groupTitle} testID={`group-title-${groupIndex}`}>
              {group.title}
            </Text>
            {group.entries.map((entry, entryIndex) => (
              <View key={entry.id} style={styles.timelineItemContainer}>
                <TimelineItem
                  entry={entry}
                  onPress={handleTimelineEntryPress}
                  testID={`timeline-item-${entry.id}`}
                  isLastInGroup={entryIndex === group.entries.length - 1}
                />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <FloatingChatButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  timeline: {
    flex: 1,
  },
  timelineContent: {
    padding: 16,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 24,
    fontFamily: 'Manrope-SemiBold',
    textAlign: 'center',
  },
  timelineGroup: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999',
    marginBottom: 16,
    marginLeft: 4,
    fontFamily: 'Manrope-Regular',
  },
  timelineItemContainer: {
    position: 'relative',
  },
});

