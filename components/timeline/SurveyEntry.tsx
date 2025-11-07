import { AppColors } from '@/constants/Colors';
import { StyleSheet, Text, View } from 'react-native';
import { SurveyEntry as SurveyEntryType } from '@/types';

interface SurveyEntryProps {
  entry: SurveyEntryType;
}

export function SurveyEntry({ entry }: SurveyEntryProps) {
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
          <Text style={styles.icon}>📊</Text>
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{entry.surveyTitle}</Text>
          <Text style={styles.timestamp}>{formattedDate}</Text>
        </View>
      </View>
      <View style={styles.responses}>
        {entry.responses.map((response, index) => (
          <View key={index} style={styles.responseRow}>
            <Text style={styles.question}>{response.question}</Text>
            <Text style={styles.answer}>{response.answer}</Text>
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
    backgroundColor: '#e3f2fd',
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
  },
  answer: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 8,
  },
});

