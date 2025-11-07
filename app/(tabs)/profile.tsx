import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/auth.service';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// MOCKED DATA - temporary, will be replaced with real data later
const mockProfile = {
  name: 'Alex',
  email: 'alex@example.com',
  position: 'Senior Developer',
  department: 'Engineering',
  joinedAt: '2023-03-15',
};

export default function ProfileScreen() {
  const { user } = useAuth();

  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
      console.error('Sign out error:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{mockProfile.name}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email || mockProfile.email}</Text>
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

        <Pressable 
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.signOutButtonPressed
          ]}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutButtonText}>Выйти</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
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
  signOutButton: {
    backgroundColor: '#ff3b30',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signOutButtonPressed: {
    opacity: 0.7,
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

