import { AppColors } from '@/constants/Colors';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { mockBoss } from '@/utils/mockData';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function BossDetailsScreen() {
  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('boss_details_screen_viewed');
    }, [])
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Boss Details',
          headerShown: true,
          headerBackTitle: '',
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerTintColor: '#000',
          headerTitleStyle: {
            color: '#000',
          },
        }}
      />
      <ScrollView style={styles.container} testID="boss-details-scroll">
        <View style={styles.content} testID="boss-details-content">
          <View style={styles.section} testID="section-name">
            <Text style={styles.label} testID="label-name">Name</Text>
            <Text style={styles.value} testID="value-name">{mockBoss.name}</Text>
          </View>

          <View style={styles.section} testID="section-position">
            <Text style={styles.label} testID="label-position">Position</Text>
            <Text style={styles.value} testID="value-position">{mockBoss.position}</Text>
          </View>

          <View style={styles.section} testID="section-department">
            <Text style={styles.label} testID="label-department">Department</Text>
            <Text style={styles.value} testID="value-department">{mockBoss.department}</Text>
          </View>

          <View style={styles.section} testID="section-started-at">
            <Text style={styles.label} testID="label-started-at">Started At</Text>
            <Text style={styles.value} testID="value-started-at">{mockBoss.startedAt}</Text>
          </View>

          <View style={styles.section} testID="section-birthday">
            <Text style={styles.label} testID="label-birthday">Birthday</Text>
            <Text style={styles.value} testID="value-birthday">{mockBoss.birthday}</Text>
          </View>

          <View style={styles.section} testID="section-management-style">
            <Text style={styles.label} testID="label-management-style">Management Style</Text>
            <Text style={styles.value} testID="value-management-style">{mockBoss.managementStyle}</Text>
          </View>

          <View style={styles.section} testID="section-current-mood">
            <Text style={styles.label} testID="label-current-mood">Current Mood</Text>
            <Text style={styles.value} testID="value-current-mood">{mockBoss.currentMood}</Text>
          </View>

          <View style={styles.section} testID="section-favorite-color">
            <Text style={styles.label} testID="label-favorite-color">Favorite Color</Text>
            <Text style={styles.value} testID="value-favorite-color">{mockBoss.favoriteColor}</Text>
          </View>

          <View style={styles.section} testID="section-communication-preference">
            <Text style={styles.label} testID="label-communication-preference">Communication Preference</Text>
            <Text style={styles.value} testID="value-communication-preference">{mockBoss.communicationPreference}</Text>
          </View>

          <View style={styles.section} testID="section-meeting-frequency">
            <Text style={styles.label} testID="label-meeting-frequency">Meeting Frequency</Text>
            <Text style={styles.value} testID="value-meeting-frequency">{mockBoss.meetingFrequency}</Text>
          </View>

          <View style={styles.section} testID="section-working-hours">
            <Text style={styles.label} testID="label-working-hours">Working Hours</Text>
            <Text style={styles.value} testID="value-working-hours">{mockBoss.workingHours}</Text>
          </View>

          <View style={styles.section} testID="section-key-interests">
            <Text style={styles.label} testID="label-key-interests">Key Interests</Text>
            {mockBoss.keyInterests.map((interest, index) => (
              <View key={index} style={styles.interestTag} testID={`interest-tag-${index}`}>
                <Text style={styles.interestText} testID={`interest-text-${index}`}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>
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
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    fontFamily: 'Manrope-SemiBold',
  },
  value: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    lineHeight: 22,
    fontFamily: 'Manrope-Regular',
  },
  interestTag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  interestText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
    fontFamily: 'Manrope-Regular',
  },
});

