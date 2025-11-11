import { AppColors } from '@/constants/Colors';
import { StyleSheet, Text, View } from 'react-native';
import { SurveyEntry as SurveyEntryType } from '@/types';

interface SurveyEntryProps {
  entry: SurveyEntryType;
  testID?: string;
}

export function SurveyEntry({ entry, testID }: SurveyEntryProps) {
  return (
    <View style={styles.container} testID={testID ? `${testID}-container` : 'survey-entry-container'}>
      <View style={styles.header} testID={testID ? `${testID}-header` : 'survey-entry-header'}>
        <View style={styles.iconContainer} testID={testID ? `${testID}-icon-container` : 'survey-entry-icon-container'}>
          <Text style={styles.icon} testID={testID ? `${testID}-icon` : 'survey-entry-icon'}>📊</Text>
        </View>
        <Text style={styles.title} testID={testID ? `${testID}-title` : 'survey-entry-title'}>{entry.surveyTitle}</Text>
      </View>
      <View style={styles.responses} testID={testID ? `${testID}-responses` : 'survey-entry-responses'}>
        {entry.responses.map((response, index) => (
          <View key={index} style={styles.responseRow} testID={testID ? `${testID}-response-${index}` : `survey-entry-response-${index}`}>
            <Text style={styles.question} testID={testID ? `${testID}-question-${index}` : `survey-entry-question-${index}`}>{response.question}</Text>
            <Text style={styles.answer} testID={testID ? `${testID}-answer-${index}` : `survey-entry-answer-${index}`}>{response.answer}</Text>
          </View>
        ))}
      </View>
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
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    fontFamily: 'Manrope-SemiBold',
  },
  responses: {
    gap: 8,
  },
  responseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  question: {
    fontSize: 14,
    color: AppColors.textSecondary,
    flex: 1,
    fontFamily: 'Manrope-Regular',
  },
  answer: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 8,
    fontFamily: 'Manrope-SemiBold',
  },
});

