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
      <View style={styles.content}>
        {timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
        <Text style={styles.title} testID={testID ? `${testID}-title` : 'interaction-entry-title'}>{entry.interactionType}</Text>
      </View>
      <View style={styles.iconContainer}>
        <Text style={styles.moodEmoji} testID={testID ? `${testID}-mood-emoji` : 'interaction-entry-mood-emoji'}>{moodEmoji}</Text>
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
  moodEmoji: {
    fontSize: 24,
  },
});

