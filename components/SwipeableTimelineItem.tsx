import { TimelineItem } from '@/components/timeline/TimelineItem';
import { TimelineEntry } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import Swipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated from 'react-native-reanimated';

interface SwipeableTimelineItemProps {
  entry: TimelineEntry;
  onPress?: (entry: TimelineEntry) => void;
  onDelete: (entryId: string) => void;
  testID?: string;
  isLastInGroup?: boolean;
}

/**
 * Swipeable wrapper for TimelineItem with delete action on swipe left
 * Displays red background with trash icon when swiped
 */
export function SwipeableTimelineItem({
  entry,
  onPress,
  onDelete,
  testID,
  isLastInGroup,
}: SwipeableTimelineItemProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const [isSwiping, setIsSwiping] = useState(false);

  const handleDelete = (): void => {
    swipeableRef.current?.close();
    onDelete(entry.id);
  };

  const renderRightActions = () => (
    <Animated.View style={styles.deleteButtonContainer}>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDelete}
        activeOpacity={0.8}
        testID={`delete-button-${entry.id}`}
      >
        <Ionicons name="trash" size={24} color="#fff" />
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableWillOpen={() => setIsSwiping(true)}
      onSwipeableClose={() => setIsSwiping(false)}
      testID={`swipeable-timeline-${entry.id}`}
    >
      <TimelineItem
        entry={entry}
        onPress={isSwiping ? undefined : onPress}
        testID={testID}
        isLastInGroup={isLastInGroup}
      />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteButtonContainer: {
    height: '100%',
    paddingBottom: 8,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    height: '100%',
    borderRadius: 16,
    marginLeft: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    marginTop: 4,
  },
});

