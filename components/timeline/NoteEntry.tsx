import { AppColors } from '@/constants/Colors';
import { StyleSheet, Text, View } from 'react-native';
import { NoteEntry as NoteEntryType } from '@/types';

interface NoteEntryProps {
  entry: NoteEntryType;
}

export function NoteEntry({ entry }: NoteEntryProps) {
  const date = new Date(entry.timestamp);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📝</Text>
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{entry.title || 'Note'}</Text>
          <Text style={styles.timestamp}>{formattedDate}</Text>
        </View>
      </View>
      <Text style={styles.content}>{entry.content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  content: {
    fontSize: 14,
    color: AppColors.textSecondary,
    lineHeight: 20,
  },
});

