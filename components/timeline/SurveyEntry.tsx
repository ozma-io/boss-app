import { StyleSheet, Text, View } from 'react-native';
import { SurveyEntry as SurveyEntryType } from '@/types';

interface SurveyEntryProps {
  entry: SurveyEntryType;
  testID?: string;
  timestamp?: string;
}

export function SurveyEntry({ entry, testID, timestamp }: SurveyEntryProps) {
  return (
    <View style={styles.container} testID={testID ? `${testID}-container` : 'survey-entry-container'}>
      <View style={styles.content}>
        {timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
        <Text style={styles.title} testID={testID ? `${testID}-title` : 'survey-entry-title'}>{entry.surveyTitle}</Text>
      </View>
      <View style={styles.iconContainer} testID={testID ? `${testID}-icon-container` : 'survey-entry-icon-container'}>
        <Text style={styles.icon} testID={testID ? `${testID}-icon` : 'survey-entry-icon'}>🔍</Text>
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

