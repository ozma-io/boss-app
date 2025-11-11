import { StyleSheet, Text, View } from 'react-native';
import { NoteEntry as NoteEntryType } from '@/types';

interface NoteEntryProps {
  entry: NoteEntryType;
  testID?: string;
  timestamp?: string;
}

export function NoteEntry({ entry, testID, timestamp }: NoteEntryProps) {
  return (
    <View style={styles.container} testID={testID ? `${testID}-container` : 'note-entry-container'}>
      <View style={styles.content}>
        {timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
        <Text style={styles.title} testID={testID ? `${testID}-title` : 'note-entry-title'}>{entry.title || 'Note'}</Text>
      </View>
      <View style={styles.iconContainer} testID={testID ? `${testID}-icon-container` : 'note-entry-icon-container'}>
        <Text style={styles.icon} testID={testID ? `${testID}-icon` : 'note-entry-icon'}>📝</Text>
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
  icon: {
    fontSize: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Manrope-SemiBold',
  },
});

