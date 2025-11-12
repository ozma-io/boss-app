import { FloatingChatButton } from '@/components/FloatingChatButton';
import { TimelineItem } from '@/components/timeline/TimelineItem';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { TimelineEntry } from '@/types';
import { mockTimelineEntries } from '@/utils/mockData';
import { groupTimelineEntries } from '@/utils/timelineHelpers';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TimelineScreen() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top;

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
      <ScrollView style={styles.timeline} contentContainerStyle={[styles.timelineContent, { paddingTop: topInset + 16 }]} testID="timeline-scroll">
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
    backgroundColor: '#FAF8F0',
  },
  timeline: {
    flex: 1,
  },
  timelineContent: {
    padding: 16,
    paddingBottom: 70,
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
    overflow: 'hidden',
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    opacity: 0.8,
    marginBottom: 8,
    marginLeft: 46,
    fontFamily: 'Manrope-SemiBold',
  },
  timelineItemContainer: {
    position: 'relative',
  },
});

