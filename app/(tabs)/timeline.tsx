import { AddTimelineEntryButton } from '@/components/AddTimelineEntryButton';
import { AddTimelineEntryModal } from '@/components/AddTimelineEntryModal';
import { FloatingChatButton } from '@/components/FloatingChatButton';
import { SwipeableTimelineItem } from '@/components/SwipeableTimelineItem';
import { useAuth } from '@/contexts/AuthContext';
import { useBoss } from '@/hooks/useBoss';
import { useTimelineEntries } from '@/hooks/useTimelineEntries';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { logger } from '@/services/logger.service';
import { createNoteEntry, deleteTimelineEntry, updateTimelineEntry } from '@/services/timeline.service';
import { TimelineEntry } from '@/types';
import { showAlert } from '@/utils/alert';
import { groupTimelineEntries } from '@/utils/timelineHelpers';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TimelineScreen() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top;

  const { user } = useAuth();
  const { boss } = useBoss();
  const { entries, loading: entriesLoading, error } = useTimelineEntries();
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<TimelineEntry | undefined>(undefined);

  const loading = entriesLoading;

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('timeline_screen_viewed');
    }, [])
  );

  useEffect(() => {
    if (!loading && entries.length > 0) {
      trackAmplitudeEvent('timeline_data_loaded', {
        entriesCount: entries.length,
        bossId: boss?.id,
      });
    }
  }, [loading, entries.length, boss?.id]);

  const timelineGroups = groupTimelineEntries(entries);

  const handleTimelineEntryPress = (entry: TimelineEntry): void => {
    setEntryToEdit(entry);
    setIsAddModalVisible(true);
  };

  const handleCloseModal = useCallback((): void => {
    setIsAddModalVisible(false);
    setEntryToEdit(undefined);
  }, []);

  const handleCreateEmptyEntry = useCallback(async (): Promise<string> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // Create empty note entry (default type)
      const entryId = await createNoteEntry(user.id, {
        type: 'note',
        subtype: 'note',
        title: '',
        content: '',
        timestamp: new Date().toISOString(),
      });

      trackAmplitudeEvent('timeline_entry_created', {
        entryType: 'note',
        subtype: 'note',
        bossId: boss?.id,
      });

      logger.info('Timeline empty entry created', {
        feature: 'TimelineScreen',
        bossId: boss?.id,
        entryId,
      });

      return entryId;
    } catch (err) {
      logger.error('Failed to create empty timeline entry', {
        feature: 'TimelineScreen',
        bossId: boss?.id,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    }
  }, [user, boss?.id]);

  const handleUpdateEntry = async (entryId: string, updates: Partial<TimelineEntry>): Promise<void> => {
    if (!user) {
      showAlert('Error', 'Unable to update entry. Please try again.');
      return;
    }

    try {
      await updateTimelineEntry(user.id, entryId, updates);

      trackAmplitudeEvent('timeline_entry_updated', {
        entryId,
        bossId: boss?.id,
      });

      logger.info('Timeline entry updated', {
        feature: 'TimelineScreen',
        bossId: boss?.id,
        entryId,
      });
    } catch (err) {
      logger.error('Failed to update timeline entry', {
        feature: 'TimelineScreen',
        bossId: boss?.id,
        entryId,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    }
  };

  const handleDeleteEntry = (entryId: string): void => {
    if (!user) return;

    showAlert(
      'Delete Entry',
      'Are you sure you want to delete this entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTimelineEntry(user.id, entryId);

              trackAmplitudeEvent('timeline_entry_deleted', {
                entryId,
                bossId: boss?.id,
              });

              logger.info('Timeline entry deleted', {
                feature: 'TimelineScreen',
                bossId: boss?.id,
                entryId,
              });
            } catch (err) {
              logger.error('Failed to delete timeline entry', {
                feature: 'TimelineScreen',
                bossId: boss?.id,
                entryId,
                error: err instanceof Error ? err : new Error(String(err)),
              });
              showAlert(
                'Error',
                'Failed to delete entry. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container} testID="timeline-container">
        {loading ? (
          <View style={[styles.centerContent, { flex: 1 }]} testID="timeline-loading">
            <ActivityIndicator size="large" color="#B6D95C" />
            <Text style={styles.loadingText}>Loading timeline...</Text>
          </View>
        ) : error ? (
          <View style={[styles.centerContent, { flex: 1 }]} testID="timeline-error">
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>Please check your connection or try again later.</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={[styles.centerContent, { flex: 1 }]} testID="timeline-empty">
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>No timeline entries yet</Text>
            <Text style={styles.emptyHint}>Start tracking your interactions with your boss</Text>
            <AddTimelineEntryButton onPress={() => setIsAddModalVisible(true)} />
          </View>
        ) : (
          <ScrollView style={styles.timeline} contentContainerStyle={[styles.timelineContent, { paddingTop: topInset + 16 }]} testID="timeline-scroll">
            <Text style={styles.timelineTitle} testID="timeline-title">BossUp</Text>
            <View style={styles.timelineWrapper}>
              {entries.length > 0 && (
                <View style={styles.timelineLine} />
              )}
              <View style={styles.timelineItems}>
                {timelineGroups.map((group, groupIndex) => (
                  <View key={group.title} style={styles.timelineGroup}>
                    <Text style={styles.groupTitle} testID={`group-title-${groupIndex}`}>
                      {group.title}
                    </Text>
                    {group.entries.map((entry, entryIndex) => (
                      <View key={entry.id} style={styles.timelineItemContainer}>
                        <SwipeableTimelineItem
                          entry={entry}
                          onPress={handleTimelineEntryPress}
                          onDelete={handleDeleteEntry}
                          testID={`timeline-item-${entry.id}`}
                          isLastInGroup={entryIndex === group.entries.length - 1}
                        />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </View>
            <AddTimelineEntryButton onPress={() => setIsAddModalVisible(true)} />
          </ScrollView>
        )}

        <FloatingChatButton />

        <AddTimelineEntryModal
          isVisible={isAddModalVisible}
          onClose={handleCloseModal}
          onCreateEmpty={handleCreateEmptyEntry}
          onUpdate={handleUpdateEntry}
          entryToEdit={entryToEdit}
        />
      </View>
    </GestureHandlerRootView>
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
    padding: 12,
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
  timelineWrapper: {
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    top: 70,
    bottom: 70,
    left: 4.5,
    width: 1,
    backgroundColor: '#E1DFD8',
    zIndex: 1,
  },
  timelineItems: {
    position: 'relative',
    zIndex: 2,
  },
  timelineGroup: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(0, 0, 0, 0.2)',
    opacity: 0.8,
    marginBottom: 8,
    marginLeft: 38,
    fontFamily: 'Manrope-SemiBold',
  },
  timelineItemContainer: {
    position: 'relative',
  },
});
