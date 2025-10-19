import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

// MOCKED DATA - temporary, will be replaced with real data later
const mockProfile = {
  name: 'Ivan Petrov',
  email: 'ivan.petrov@example.com',
  phone: '+7 (999) 987-65-43',
  position: 'Senior Developer',
  department: 'Engineering',
  joinedAt: '2023-03-15',
};

export default function ProfileScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Profile',
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
            <Text style={styles.value}>{mockProfile.name}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{mockProfile.email}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{mockProfile.phone}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Position</Text>
            <Text style={styles.value}>{mockProfile.position}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Department</Text>
            <Text style={styles.value}>{mockProfile.department}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Joined At</Text>
            <Text style={styles.value}>{mockProfile.joinedAt}</Text>
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
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});

