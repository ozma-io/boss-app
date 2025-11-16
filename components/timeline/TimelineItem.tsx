import { TimelineEntry } from '@/types';
import { formatTimelineDate } from '@/utils/timelineHelpers';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { TimelineEntryCard } from './TimelineEntryCard';

interface TimelineItemProps {
  entry: TimelineEntry;
  onPress?: (entry: TimelineEntry) => void;
  testID?: string;
  isLastInGroup?: boolean;
}

export function TimelineItem({ entry, onPress, testID, isLastInGroup }: TimelineItemProps) {
  const handlePress = (): void => {
    if (onPress) {
      onPress(entry);
    }
  };

  const renderEntry = () => {
    const timestamp = formatTimelineDate(entry.timestamp);
    return <TimelineEntryCard entry={entry} testID={testID} timestamp={timestamp} />;
  };

  const content = (
    <View style={styles.container}>
      <View style={styles.timelineIndicator}>
        <View style={styles.dot} />
      </View>
      <View style={styles.content}>
        {renderEntry()}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7} testID={testID} style={styles.touchable}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  timelineIndicator: {
    width: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    alignSelf: 'stretch',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E1DFD8',
    zIndex: 2,
  },
  content: {
    flex: 1,
    marginLeft: 8,
  },
});

