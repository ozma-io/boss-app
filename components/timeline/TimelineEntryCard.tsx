import { DEFAULT_TIMELINE_ICONS } from '@/constants/timeline';
import { TimelineEntry } from '@/types';
import { StyleSheet, Text, View } from 'react-native';

interface TimelineEntryCardProps {
  entry: TimelineEntry;
  testID?: string;
  timestamp?: string;
}

const getIcon = (entry: TimelineEntry): string => {
  // Use custom icon if provided
  if (entry.icon) {
    return entry.icon;
  }
  
  // Fall back to default icons based on subtype
    return DEFAULT_TIMELINE_ICONS[entry.subtype];
};

const getTitle = (entry: TimelineEntry): string => {
  return entry.title;
};

export function TimelineEntryCard({ entry, testID, timestamp }: TimelineEntryCardProps) {
  const icon = getIcon(entry);
  const title = getTitle(entry);

  return (
    <View style={styles.container} testID={testID ? `${testID}-container` : `${entry.type}-entry-container`}>
      <View style={styles.content}>
        {timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
        <Text style={styles.title} testID={testID ? `${testID}-title` : `${entry.type}-entry-title`}>{title}</Text>
      </View>
      <View style={styles.iconContainer} testID={testID ? `${testID}-icon-container` : `${entry.type}-entry-icon-container`}>
        <Text style={styles.icon} testID={testID ? `${testID}-icon` : `${entry.type}-entry-icon`}>{icon}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    fontFamily: 'Manrope-Regular',
  },
  iconContainer: {
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#FAF8F0',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Manrope-SemiBold',
  },
  icon: {
    fontSize: 24,
  },
});

