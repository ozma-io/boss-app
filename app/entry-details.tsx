import { DEFAULT_TIMELINE_ICONS } from '@/constants/timeline';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { TimelineEntry } from '@/types';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function EntryDetailsScreen() {
  const { entryId, entryData } = useLocalSearchParams<{
    entryId: string;
    entryData: string;
  }>();
  const entry: TimelineEntry | null = entryData ? JSON.parse(entryData) : null;

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('entry_details_screen_viewed');
    }, [])
  );

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
    if (entry.type === 'note') {
      const icon = entry.icon || DEFAULT_TIMELINE_ICONS[entry.subtype];
      
      return (
        <>
          <View style={styles.iconContainer} testID="note-icon-container">
            <Text style={styles.largeIcon} testID="note-icon">{icon}</Text>
          </View>
          <Text style={styles.title} testID="note-title">{entry.title}</Text>
          <View style={styles.subtypeBadge} testID="note-subtype-badge">
            <Text style={styles.subtypeText} testID="note-subtype-text">{entry.subtype}</Text>
          </View>
          <Text style={styles.timestamp} testID="note-timestamp">{formattedDate}</Text>
          
          <View style={styles.section} testID="note-content-section">
            <Text style={styles.sectionLabel} testID="note-content-label">CONTENT</Text>
            <Text style={styles.contentText} testID="note-content-text">{entry.content}</Text>
          </View>
        </>
      );
    }
    
    // Fact entry
    const icon = entry.icon || DEFAULT_TIMELINE_ICONS.fact;
    
    return (
      <>
        <View style={styles.iconContainer} testID="fact-icon-container">
          <Text style={styles.largeIcon} testID="fact-icon">{icon}</Text>
        </View>
        <Text style={styles.title} testID="fact-title">{entry.title}</Text>
        <Text style={styles.timestamp} testID="fact-timestamp">{formattedDate}</Text>
        
        <View style={styles.section} testID="fact-value-section">
          <Text style={styles.sectionLabel} testID="fact-value-label">VALUE</Text>
          <Text style={styles.factValue} testID="fact-value-text">
            {Array.isArray(entry.value) ? entry.value.join(', ') : entry.value}
          </Text>
        </View>

        {entry.content && (
          <View style={styles.section} testID="fact-content-section">
            <Text style={styles.sectionLabel} testID="fact-content-label">CONTENT</Text>
            <Text style={styles.contentText} testID="fact-content-text">{entry.content}</Text>
          </View>
        )}

        {entry.source && (
          <View style={styles.section} testID="fact-source-section">
            <Text style={styles.sectionLabel} testID="fact-source-label">SOURCE</Text>
            <Text style={styles.contentText} testID="fact-source-text">{entry.source}</Text>
          </View>
        )}
      </>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="entry-details-scroll">
      {renderContent()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F0',
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
  subtypeBadge: {
    alignSelf: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  subtypeText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '600',
    textTransform: 'capitalize',
    fontFamily: 'Manrope-SemiBold',
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
  factValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
    fontFamily: 'Manrope-Bold',
  },
});

