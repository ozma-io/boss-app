import { AppColors } from '@/constants/Colors';
import { StyleSheet, Text, View } from 'react-native';
import { NoteEntry as NoteEntryType } from '@/types';

interface NoteEntryProps {
  entry: NoteEntryType;
  testID?: string;
}

export function NoteEntry({ entry, testID }: NoteEntryProps) {
  const date = new Date(entry.timestamp);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.container} testID={testID ? `${testID}-container` : 'note-entry-container'}>
      <View style={styles.header} testID={testID ? `${testID}-header` : 'note-entry-header'}>
        <View style={styles.iconContainer} testID={testID ? `${testID}-icon-container` : 'note-entry-icon-container'}>
          <Text style={styles.icon} testID={testID ? `${testID}-icon` : 'note-entry-icon'}>📝</Text>
        </View>
        <View style={styles.headerContent} testID={testID ? `${testID}-header-content` : 'note-entry-header-content'}>
          <Text style={styles.title} testID={testID ? `${testID}-title` : 'note-entry-title'}>{entry.title || 'Note'}</Text>
          <Text style={styles.timestamp} testID={testID ? `${testID}-timestamp` : 'note-entry-timestamp'}>{formattedDate}</Text>
        </View>
      </View>
      <Text style={styles.content} testID={testID ? `${testID}-content` : 'note-entry-content'}>{entry.content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
    fontFamily: 'Manrope-SemiBold',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Manrope-Regular',
  },
  content: {
    fontSize: 14,
    color: AppColors.textSecondary,
    lineHeight: 20,
    fontFamily: 'Manrope-Regular',
  },
});

