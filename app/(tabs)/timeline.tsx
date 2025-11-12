import { FloatingChatButton } from '@/components/FloatingChatButton';
import { TimelineItem } from '@/components/timeline/TimelineItem';
import { useBoss } from '@/hooks/useBoss';
import { useTimelineEntries } from '@/hooks/useTimelineEntries';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { TimelineEntry } from '@/types';
import { groupTimelineEntries } from '@/utils/timelineHelpers';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TimelineScreen() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top;

  const { boss, loading: bossLoading } = useBoss();
  const { entries, loading: entriesLoading, error } = useTimelineEntries(boss?.id);

  const loading = bossLoading || entriesLoading;

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('timeline_screen_viewed');
      
      if (!loading && entries.length > 0) {
        trackAmplitudeEvent('timeline_data_loaded', {
          entriesCount: entries.length,
          bossId: boss?.id,
        });
      }
    }, [loading, entries.length, boss?.id])
  );

  const timelineGroups = groupTimelineEntries(entries);

  const handleTimelineEntryPress = (entry: TimelineEntry): void => {
    router.push({
      pathname: '/entry-details',
      params: { entryId: entry.id },
    });
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]} testID="timeline-loading">
        <ActivityIndicator size="large" color="#B6D95C" />
        <Text style={styles.loadingText}>Loading timeline...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]} testID="timeline-error">
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorHint}>Please check your connection or try again later.</Text>
      </View>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]} testID="timeline-empty">
        <Text style={styles.emptyIcon}>📝</Text>
        <Text style={styles.emptyText}>No timeline entries yet</Text>
        <Text style={styles.emptyHint}>Start tracking your interactions with your boss</Text>
      </View>
    );
  }

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
