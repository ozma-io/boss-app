import { TimelineItem } from '@/components/timeline/TimelineItem';
import { TimelineEntry } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import Swipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';

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

  const renderRightActions = (
    _progress: SharedValue<number>,
    drag: SharedValue<number>
  ) => {
    // Animated style for delete button - fade in as user swipes
    const deleteButtonStyle = useAnimatedStyle(() => {
      return {
        opacity: Math.min(1, Math.abs(drag.value) / 50),
      };
    });

    return (
      <Animated.View style={[styles.deleteButtonContainer, deleteButtonStyle]}>
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
  };

  const animatedChildren = (
    progress: SharedValue<number>,
    drag: SharedValue<number>
  ) => {
    // Animated style for content - shrink width as user swipes left
    const contentStyle = useAnimatedStyle(() => {
      // drag.value is negative when swiping left
      // Reduce width by the drag amount (max 96px for delete button + margin)
      const reduction = Math.max(0, Math.min(96, Math.abs(drag.value)));
      return {
        width: `${100 - (reduction / 4)}%`,
        marginRight: reduction,
      };
    });

    return (
      <Animated.View style={contentStyle}>
        <TimelineItem
          entry={entry}
          onPress={isSwiping ? undefined : onPress}
          testID={testID}
          isLastInGroup={isLastInGroup}
        />
      </Animated.View>
    );
  };

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
      {animatedChildren}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteButtonContainer: {
    height: '100%',
    paddingBottom: 8,
    justifyContent: 'center',
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

