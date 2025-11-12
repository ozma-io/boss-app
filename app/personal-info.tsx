import { AppColors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { signOut } from '@/services/auth.service';
import { openPrivacyPolicy, openTermsOfService } from '@/services/policy.service';
import { mockUserProfile } from '@/utils/mockData';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PersonalInfoScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(mockUserProfile.name);
  const [isEditingName, setIsEditingName] = useState(false);

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('personal_info_screen_viewed');
    }, [])
  );

  const handleSignOut = async (): Promise<void> => {
    trackAmplitudeEvent('auth_signout_clicked', {
      email: user?.email || '[no_email]',
      screen: 'personal_info',
    });
    
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
      console.error('Sign out error:', error);
    }
  };

  const handleBlurName = (): void => {
    setIsEditingName(false);
    // TODO: Save name to backend
  };

  const saveAllFields = (): void => {
    // TODO: Save all fields to backend
    console.log('Saving fields:', { name });
  };

  useEffect(() => {
    return () => {
      if (isEditingName) {
        saveAllFields();
      }
    };
  }, [isEditingName, name]);

  return (
    <View style={styles.container} testID="personal-info-container">
      <ScrollView style={styles.scrollView} testID="personal-info-scroll">
        <View style={styles.content} testID="personal-info-content">
          <View style={styles.infoBlock}>
            <Pressable
              style={styles.infoItem}
              onPress={() => setIsEditingName(true)}
              testID="info-item-name"
            >
              <View style={styles.iconContainer} testID="icon-container-name">
                <FontAwesome name="user" size={20} color="#666" testID="icon-name" />
              </View>
              <View style={styles.infoContent} testID="info-content-name">
                <Text style={styles.label} testID="label-name">Name</Text>
                {isEditingName ? (
                  <TextInput
                    style={[styles.valueInput, { outlineStyle: 'none' } as any]}
                    value={name}
                    onChangeText={setName}
                    onBlur={handleBlurName}
                    autoFocus
                    testID="input-name"
                  />
                ) : (
                  <Text style={styles.value} testID="value-name">{name}</Text>
                )}
              </View>
            </Pressable>

            <View style={styles.infoItem} testID="info-item-email">
              <View style={styles.iconContainer} testID="icon-container-email">
                <FontAwesome name="envelope" size={20} color="#666" testID="icon-email" />
              </View>
              <View style={styles.infoContent} testID="info-content-email">
                <Text style={styles.label} testID="label-email">Email</Text>
                <Text style={styles.value} testID="value-email">{user?.email || mockUserProfile.email}</Text>
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

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 40) }]} testID="footer">
        <Pressable onPress={openPrivacyPolicy} testID="footer-privacy-button">
          <Text style={styles.footerLink} testID="footer-privacy-text">Privacy policy</Text>
        </Pressable>
        <Pressable onPress={openTermsOfService} testID="footer-terms-button">
          <Text style={styles.footerLink} testID="footer-terms-text">Terms of service</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollView: {
    flex: 1,
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
  valueInput: {
    fontSize: 16,
    color: '#999',
    fontFamily: 'Manrope-Regular',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    textAlign: 'right',
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: AppColors.background,
  },
  footerLink: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Manrope-Regular',
  },
});

