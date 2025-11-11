import { InteractionEntry as InteractionEntryType } from '@/types';
import { StyleSheet, Text, View } from 'react-native';

interface InteractionEntryProps {
  entry: InteractionEntryType;
  testID?: string;
  timestamp?: string;
}

const moodEmojis: Record<string, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😕',
};

export function InteractionEntry({ entry, testID, timestamp }: InteractionEntryProps) {
  const moodEmoji = moodEmojis[entry.mood] || '😐';

  return (
    <View style={styles.container} testID={testID ? `${testID}-container` : 'interaction-entry-container'}>
      {timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
      <View style={styles.header} testID={testID ? `${testID}-header` : 'interaction-entry-header'}>
        <View style={styles.iconContainer} testID={testID ? `${testID}-icon-container` : 'interaction-entry-icon-container'}>
          <Text style={styles.icon} testID={testID ? `${testID}-icon` : 'interaction-entry-icon'}>📝</Text>
        </View>
        <Text style={styles.title} testID={testID ? `${testID}-title` : 'interaction-entry-title'}>{entry.interactionType}</Text>
        <Text style={styles.moodEmoji} testID={testID ? `${testID}-mood-emoji` : 'interaction-entry-mood-emoji'}>{moodEmoji}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 0,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    elevation: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    fontFamily: 'Manrope-Regular',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF9E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    fontFamily: 'Manrope-SemiBold',
  },
  moodEmoji: {
    fontSize: 32,
    marginLeft: 8,
  },
});

