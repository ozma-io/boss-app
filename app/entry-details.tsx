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
      <View style={styles.container}>
        <Text>Entry not found</Text>
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
            <View style={styles.iconContainer}>
              <Text style={styles.largeIcon}>📝</Text>
            </View>
            <Text style={styles.title}>{entry.title || 'Note'}</Text>
            <Text style={styles.timestamp}>{formattedDate}</Text>
            
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CONTENT</Text>
              <Text style={styles.contentText}>{entry.content}</Text>
            </View>

            {entry.tags && entry.tags.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>TAGS</Text>
                <View style={styles.tagContainer}>
                  {entry.tags.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
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
            <View style={styles.iconContainer}>
              <Text style={styles.largeIcon}>📊</Text>
            </View>
            <Text style={styles.title}>{entry.surveyTitle}</Text>
            <Text style={styles.timestamp}>{formattedDate}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>RESPONSES</Text>
              {entry.responses.map((response, index) => {
                const answerValue = response.answer;
                const isNumericRating = typeof answerValue === 'number' && answerValue <= 5;
                return (
                  <View key={index} style={styles.responseItem}>
                    <Text style={styles.questionText}>{response.question}</Text>
                    <View style={styles.answerContainer}>
                      <Text style={styles.answerValue}>{answerValue}</Text>
                      {isNumericRating && (
                        <View style={styles.ratingBar}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Text key={star} style={styles.star}>
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
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>NOTES</Text>
                <Text style={styles.contentText}>{entry.notes}</Text>
              </View>
            )}
          </>
        );

      case 'interaction':
        const moodEmoji = moodEmojis[entry.mood] || '😐';
        return (
          <>
            <View style={styles.iconContainer}>
              <Text style={styles.largeIcon}>💬</Text>
            </View>
            <Text style={styles.title}>{entry.interactionType}</Text>
            <Text style={styles.timestamp}>{formattedDate}</Text>

            <View style={styles.moodSection}>
              <Text style={styles.moodLabel}>Mood</Text>
              <View style={styles.moodDisplay}>
                <Text style={styles.moodEmojiLarge}>{moodEmoji}</Text>
                <Text style={styles.moodText}>{entry.mood}</Text>
              </View>
            </View>

            {entry.duration !== undefined && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>DURATION</Text>
                <Text style={styles.durationText}>{entry.duration} minutes</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>NOTES</Text>
              <Text style={styles.contentText}>{entry.notes}</Text>
            </View>

            {entry.participants && entry.participants.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PARTICIPANTS</Text>
                {entry.participants.map((participant, index) => (
                  <Text key={index} style={styles.participantText}>• {participant}</Text>
                ))}
              </View>
            )}

            {entry.topics && entry.topics.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>TOPICS DISCUSSED</Text>
                <View style={styles.tagContainer}>
                  {entry.topics.map((topic, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{topic}</Text>
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
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {renderContent()}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  },
  contentText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
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
  },
  responseItem: {
    marginBottom: 16,
  },
  questionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  answerContainer: {
    alignItems: 'flex-start',
  },
  answerValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
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
  },
  durationText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  participantText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 6,
    lineHeight: 22,
  },
});

