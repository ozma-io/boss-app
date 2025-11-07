import { AppColors } from '@/constants/Colors';
import { mockTimelineEntries } from '@/utils/mockData';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const moodEmojis: Record<string, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😕',
};

export default function EntryDetailsScreen() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const entry = mockTimelineEntries.find((e) => e.id === entryId);

  if (!entry) {
    return (
      <View style={styles.container} testID="entry-not-found-container">
        <Text testID="entry-not-found-text">Entry not found</Text>
      </View>
    );
  }

  const date = new Date(entry.timestamp);
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const renderContent = () => {
    switch (entry.type) {
      case 'note':
        return (
          <>
            <View style={styles.iconContainer} testID="note-icon-container">
              <Text style={styles.largeIcon} testID="note-icon">📝</Text>
            </View>
            <Text style={styles.title} testID="note-title">{entry.title || 'Note'}</Text>
            <Text style={styles.timestamp} testID="note-timestamp">{formattedDate}</Text>
            
            <View style={styles.section} testID="note-content-section">
              <Text style={styles.sectionLabel} testID="note-content-label">CONTENT</Text>
              <Text style={styles.contentText} testID="note-content-text">{entry.content}</Text>
            </View>

            {entry.tags && entry.tags.length > 0 && (
              <View style={styles.section} testID="note-tags-section">
                <Text style={styles.sectionLabel} testID="note-tags-label">TAGS</Text>
                <View style={styles.tagContainer} testID="note-tags-container">
                  {entry.tags.map((tag, index) => (
                    <View key={index} style={styles.tag} testID={`note-tag-${index}`}>
                      <Text style={styles.tagText} testID={`note-tag-text-${index}`}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        );

      case 'survey':
        return (
          <>
            <View style={styles.iconContainer} testID="survey-icon-container">
              <Text style={styles.largeIcon} testID="survey-icon">📊</Text>
            </View>
            <Text style={styles.title} testID="survey-title">{entry.surveyTitle}</Text>
            <Text style={styles.timestamp} testID="survey-timestamp">{formattedDate}</Text>

            <View style={styles.section} testID="survey-responses-section">
              <Text style={styles.sectionLabel} testID="survey-responses-label">RESPONSES</Text>
              {entry.responses.map((response, index) => {
                const answerValue = response.answer;
                const isNumericRating = typeof answerValue === 'number' && answerValue <= 5;
                return (
                  <View key={index} style={styles.responseItem} testID={`survey-response-${index}`}>
                    <Text style={styles.questionText} testID={`survey-question-${index}`}>{response.question}</Text>
                    <View style={styles.answerContainer} testID={`survey-answer-container-${index}`}>
                      <Text style={styles.answerValue} testID={`survey-answer-value-${index}`}>{answerValue}</Text>
                      {isNumericRating && (
                        <View style={styles.ratingBar} testID={`survey-rating-bar-${index}`}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Text key={star} style={styles.star} testID={`survey-star-${index}-${star}`}>
                              {star <= (answerValue as number) ? '⭐' : '☆'}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {entry.notes && (
              <View style={styles.section} testID="survey-notes-section">
                <Text style={styles.sectionLabel} testID="survey-notes-label">NOTES</Text>
                <Text style={styles.contentText} testID="survey-notes-text">{entry.notes}</Text>
              </View>
            )}
          </>
        );

      case 'interaction':
        const moodEmoji = moodEmojis[entry.mood] || '😐';
        return (
          <>
            <View style={styles.iconContainer} testID="interaction-icon-container">
              <Text style={styles.largeIcon} testID="interaction-icon">💬</Text>
            </View>
            <Text style={styles.title} testID="interaction-title">{entry.interactionType}</Text>
            <Text style={styles.timestamp} testID="interaction-timestamp">{formattedDate}</Text>

            <View style={styles.moodSection} testID="interaction-mood-section">
              <Text style={styles.moodLabel} testID="interaction-mood-label">Mood</Text>
              <View style={styles.moodDisplay} testID="interaction-mood-display">
                <Text style={styles.moodEmojiLarge} testID="interaction-mood-emoji">{moodEmoji}</Text>
                <Text style={styles.moodText} testID="interaction-mood-text">{entry.mood}</Text>
              </View>
            </View>

            {entry.duration !== undefined && (
              <View style={styles.section} testID="interaction-duration-section">
                <Text style={styles.sectionLabel} testID="interaction-duration-label">DURATION</Text>
                <Text style={styles.durationText} testID="interaction-duration-text">{entry.duration} minutes</Text>
              </View>
            )}

            <View style={styles.section} testID="interaction-notes-section">
              <Text style={styles.sectionLabel} testID="interaction-notes-label">NOTES</Text>
              <Text style={styles.contentText} testID="interaction-notes-text">{entry.notes}</Text>
            </View>

            {entry.participants && entry.participants.length > 0 && (
              <View style={styles.section} testID="interaction-participants-section">
                <Text style={styles.sectionLabel} testID="interaction-participants-label">PARTICIPANTS</Text>
                {entry.participants.map((participant, index) => (
                  <Text key={index} style={styles.participantText} testID={`interaction-participant-${index}`}>• {participant}</Text>
                ))}
              </View>
            )}

            {entry.topics && entry.topics.length > 0 && (
              <View style={styles.section} testID="interaction-topics-section">
                <Text style={styles.sectionLabel} testID="interaction-topics-label">TOPICS DISCUSSED</Text>
                <View style={styles.tagContainer} testID="interaction-topics-container">
                  {entry.topics.map((topic, index) => (
                    <View key={index} style={styles.tag} testID={`interaction-topic-${index}`}>
                      <Text style={styles.tagText} testID={`interaction-topic-text-${index}`}>{topic}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        );
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Entry Details',
          headerShown: true,
          headerBackTitle: '',
          headerTintColor: '#000',
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="entry-details-scroll">
        {renderContent()}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    padding: 20,
  },
  iconContainer: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  largeIcon: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 1,
    marginBottom: 12,
    fontFamily: 'Manrope-Bold',
  },
  contentText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    fontFamily: 'Manrope-Regular',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
    fontFamily: 'Manrope-Regular',
  },
  responseItem: {
    marginBottom: 16,
  },
  questionText: {
    fontSize: 14,
    color: AppColors.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
    fontFamily: 'Manrope-Regular',
  },
  answerContainer: {
    alignItems: 'flex-start',
  },
  answerValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
    fontFamily: 'Manrope-Bold',
  },
  ratingBar: {
    flexDirection: 'row',
    gap: 4,
  },
  star: {
    fontSize: 18,
  },
  moodSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  moodLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 1,
    marginBottom: 12,
    fontFamily: 'Manrope-Bold',
  },
  moodDisplay: {
    alignItems: 'center',
  },
  moodEmojiLarge: {
    fontSize: 48,
    marginBottom: 8,
  },
  moodText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textTransform: 'capitalize',
    fontFamily: 'Manrope-SemiBold',
  },
  durationText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Manrope-SemiBold',
  },
  participantText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 6,
    lineHeight: 22,
    fontFamily: 'Manrope-Regular',
  },
});

