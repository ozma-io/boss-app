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

  return (
    <ScrollView style={styles.container} testID="personal-info-scroll">
      <View style={styles.content} testID="personal-info-content">
        <View style={styles.infoBlock}>
          <View style={styles.infoItem} testID="info-item-name">
            <View style={styles.iconContainer} testID="icon-container-name">
              <FontAwesome name="user" size={20} color="#666" testID="icon-name" />
            </View>
            <View style={styles.infoContent} testID="info-content-name">
              <Text style={styles.label} testID="label-name">Name</Text>
              <Text style={styles.value} testID="value-name">{mockUserProfile.name}</Text>
            </View>
          </View>

          <View style={styles.infoItem} testID="info-item-email">
            <View style={styles.iconContainer} testID="icon-container-email">
              <FontAwesome name="envelope" size={20} color="#666" testID="icon-email" />
            </View>
            <View style={styles.infoContent} testID="info-content-email">
              <Text style={styles.label} testID="label-email">Email</Text>
              <Text style={styles.value} testID="value-email">{user?.email || mockUserProfile.email}</Text>
            </View>
          </View>

          <View style={styles.infoItem} testID="info-item-position">
            <View style={styles.iconContainer} testID="icon-container-position">
              <FontAwesome name="briefcase" size={20} color="#666" testID="icon-position" />
            </View>
            <View style={styles.infoContent} testID="info-content-position">
              <Text style={styles.label} testID="label-position">Position</Text>
              <Text style={styles.value} testID="value-position">{mockUserProfile.position}</Text>
            </View>
          </View>

          <View style={styles.infoItem} testID="info-item-department">
            <View style={styles.iconContainer} testID="icon-container-department">
              <FontAwesome name="building" size={20} color="#666" testID="icon-department" />
            </View>
            <View style={styles.infoContent} testID="info-content-department">
              <Text style={styles.label} testID="label-department">Department</Text>
              <Text style={styles.value} testID="value-department">{mockUserProfile.department}</Text>
            </View>
          </View>

          <View style={[styles.infoItem, styles.lastInfoItem]} testID="info-item-joined">
            <View style={styles.iconContainer} testID="icon-container-joined">
              <FontAwesome name="calendar" size={20} color="#666" testID="icon-joined" />
            </View>
            <View style={styles.infoContent} testID="info-content-joined">
              <Text style={styles.label} testID="label-joined">Joined at</Text>
              <Text style={styles.value} testID="value-joined">{mockUserProfile.joinedAt}</Text>
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.buttonPressed
          ]}
          onPress={handleSignOut}
          testID="sign-out-button"
        >
          <Text style={styles.signOutButtonText} testID="sign-out-button-text">Sign out</Text>
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
  infoBlock: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lastInfoItem: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 40,
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Manrope-Regular',
  },
  value: {
    fontSize: 16,
    color: '#999',
    fontFamily: 'Manrope-Regular',
  },
  signOutButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 24,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  signOutButtonText: {
    color: '#ff3b30',
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});

