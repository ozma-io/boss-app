import { mockBoss } from '@/utils/mockData';
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function BossDetailsScreen() {
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
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{mockBoss.name}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Position</Text>
            <Text style={styles.value}>{mockBoss.position}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Company</Text>
            <Text style={styles.value}>{mockBoss.company}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Department</Text>
            <Text style={styles.value}>{mockBoss.department}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Started At</Text>
            <Text style={styles.value}>{mockBoss.startedAt}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Birthday</Text>
            <Text style={styles.value}>{mockBoss.birthday}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Management Style</Text>
            <Text style={styles.value}>{mockBoss.managementStyle}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Current Mood</Text>
            <Text style={styles.value}>{mockBoss.currentMood}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Favorite Color</Text>
            <Text style={styles.value}>{mockBoss.favoriteColor}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Communication Preference</Text>
            <Text style={styles.value}>{mockBoss.communicationPreference}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Meeting Frequency</Text>
            <Text style={styles.value}>{mockBoss.meetingFrequency}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Working Hours</Text>
            <Text style={styles.value}>{mockBoss.workingHours}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Key Interests</Text>
            {mockBoss.keyInterests.map((interest, index) => (
              <View key={index} style={styles.interestTag}>
                <Text style={styles.interestText}>{interest}</Text>
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
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    lineHeight: 22,
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
  },
});

