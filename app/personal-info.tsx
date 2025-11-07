import { AppColors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/auth.service';
import { mockUserProfile } from '@/utils/mockData';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PersonalInfoScreen() {
  const { user } = useAuth();

  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
      console.error('Sign out error:', error);
    }
  };

  const handleDeleteAccount = (): void => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('Delete account requested');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.infoItem}>
          <View style={styles.iconContainer}>
            <FontAwesome name="user" size={20} color="#666" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{mockUserProfile.name}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <View style={styles.iconContainer}>
            <FontAwesome name="envelope" size={20} color="#666" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email || mockUserProfile.email}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <View style={styles.iconContainer}>
            <FontAwesome name="briefcase" size={20} color="#666" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.label}>Position</Text>
            <Text style={styles.value}>{mockUserProfile.position}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <View style={styles.iconContainer}>
            <FontAwesome name="building" size={20} color="#666" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.label}>Department</Text>
            <Text style={styles.value}>{mockUserProfile.department}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <View style={styles.iconContainer}>
            <FontAwesome name="calendar" size={20} color="#666" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.label}>Joined at</Text>
            <Text style={styles.value}>{mockUserProfile.joinedAt}</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.buttonPressed
          ]}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutButtonText}>Sign out</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && styles.buttonPressed
          ]}
          onPress={handleDeleteAccount}
        >
          <Text style={styles.deleteButtonText}>Delete account</Text>
        </Pressable>
      </View>
    </ScrollView>
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
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  iconContainer: {
    width: 40,
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  label: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  signOutButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff3b30',
  },
  signOutButtonText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff3b30',
  },
  deleteButtonText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});

