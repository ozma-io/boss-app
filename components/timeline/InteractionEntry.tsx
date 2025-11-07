import { AppColors } from '@/constants/Colors';
import { StyleSheet, Text, View } from 'react-native';
import { InteractionEntry as InteractionEntryType } from '@/types';

interface InteractionEntryProps {
  entry: InteractionEntryType;
  testID?: string;
}

const moodEmojis: Record<string, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😕',
};

export function InteractionEntry({ entry, testID }: InteractionEntryProps) {
  const date = new Date(entry.timestamp);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const moodEmoji = moodEmojis[entry.mood] || '😐';

  return (
    <View style={styles.container} testID={testID ? `${testID}-container` : 'interaction-entry-container'}>
      <View style={styles.header} testID={testID ? `${testID}-header` : 'interaction-entry-header'}>
        <View style={styles.iconContainer} testID={testID ? `${testID}-icon-container` : 'interaction-entry-icon-container'}>
          <Text style={styles.icon} testID={testID ? `${testID}-icon` : 'interaction-entry-icon'}>💬</Text>
        </View>
        <View style={styles.headerContent} testID={testID ? `${testID}-header-content` : 'interaction-entry-header-content'}>
          <Text style={styles.title} testID={testID ? `${testID}-title` : 'interaction-entry-title'}>{entry.interactionType}</Text>
          <Text style={styles.timestamp} testID={testID ? `${testID}-timestamp` : 'interaction-entry-timestamp'}>{formattedDate}</Text>
        </View>
        <Text style={styles.moodEmoji} testID={testID ? `${testID}-mood-emoji` : 'interaction-entry-mood-emoji'}>{moodEmoji}</Text>
      </View>
      <Text style={styles.notes} testID={testID ? `${testID}-notes` : 'interaction-entry-notes'}>{entry.notes}</Text>
      {entry.duration !== undefined && (
        <Text style={styles.duration} testID={testID ? `${testID}-duration` : 'interaction-entry-duration'}>{entry.duration} min</Text>
      )}
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
    backgroundColor: '#f3e5f5',
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
  moodEmoji: {
    fontSize: 24,
    marginLeft: 8,
  },
  notes: {
    fontSize: 14,
    color: AppColors.textSecondary,
    lineHeight: 20,
  },
  duration: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

