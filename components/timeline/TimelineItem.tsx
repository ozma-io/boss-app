import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TimelineEntry } from '@/types';
import { formatTimelineDate } from '@/utils/timelineHelpers';
import { NoteEntry } from './NoteEntry';
import { SurveyEntry } from './SurveyEntry';
import { InteractionEntry } from './InteractionEntry';

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
    switch (entry.type) {
      case 'note':
        return <NoteEntry entry={entry} testID={testID} />;
      case 'survey':
        return <SurveyEntry entry={entry} testID={testID} />;
      case 'interaction':
        return <InteractionEntry entry={entry} testID={testID} />;
      default:
        return <NoteEntry entry={entry as any} testID={testID} />;
    }
  };

  const content = (
    <View style={styles.container}>
      <View style={styles.timelineIndicator}>
        <View style={styles.dot} />
        {!isLastInGroup && <View style={styles.line} />}
      </View>
      <View style={styles.content}>
        <Text style={styles.timestamp}>{formatTimelineDate(entry.timestamp)}</Text>
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
    marginBottom: 12,
  },
  timelineIndicator: {
    width: 24,
    alignItems: 'center',
    position: 'relative',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    zIndex: 1,
  },
  line: {
    position: 'absolute',
    top: 10,
    bottom: -12,
    width: 2,
    backgroundColor: '#D1D5DB',
    left: '50%',
    marginLeft: -1,
  },
  content: {
    flex: 1,
    marginLeft: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    fontFamily: 'Manrope-Regular',
  },
});

