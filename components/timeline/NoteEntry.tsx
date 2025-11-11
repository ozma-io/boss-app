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
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    elevation: 1,
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
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Manrope-SemiBold',
  },
});

