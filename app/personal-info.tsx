import { KEYBOARD_AWARE_SCROLL_OFFSET } from '@/constants/keyboard';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { deleteAccount } from '@/services/account-deletion.service';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { signOut } from '@/services/auth.service';
import { logger } from '@/services/logger.service';
import { openPrivacyPolicy, openTermsOfService } from '@/services/policy.service';
import { showToast } from '@/utils/toast';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { KeyboardAwareScrollView, KeyboardController } from 'react-native-keyboard-controller';
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PersonalInfoScreen() {
  const { user } = useAuth();
  const { profile, loading, error, updateProfile } = useUserProfile();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [lastAppUpdateTime, setLastAppUpdateTime] = useState<number | null>(null);
  
  // Account deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync local state with profile data when it loads
  useEffect(() => {
    if (profile) {
      setName(profile.displayName || '');
    }
  }, [profile]);

  // Load first install time from device
  useEffect(() => {
    const loadFirstInstallTime = async (): Promise<void> => {
      try {
        const timestamp = await DeviceInfo.getFirstInstallTime();
        setLastAppUpdateTime(timestamp);
      } catch (error) {
        logger.error('Failed to get first install time', { 
          feature: 'PersonalInfoScreen', 
          error: error instanceof Error ? error : new Error(String(error)) 
        });
      }
    };
    loadFirstInstallTime();
  }, []);

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('personal_info_screen_viewed');
    }, [])
  );

  const handleCopyUpdateId = async (): Promise<void> => {
    const updateId = Updates.updateId || 'embedded';
    try {
      await Clipboard.setStringAsync(updateId);
      showToast('Update ID copied to clipboard');
      trackAmplitudeEvent('personal_info_update_id_copied', {
        updateId: updateId.substring(0, 12),
      });
    } catch (error) {
      logger.error('Failed to copy update ID', { feature: 'PersonalInfoScreen', error: error instanceof Error ? error : new Error(String(error)) });
    }
  };

  const handleSignOut = async (): Promise<void> => {
    trackAmplitudeEvent('auth_signout_clicked', {
      email: user?.email || '[no_email]',
      screen: 'personal_info',
    });
    
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
      logger.error('Failed to sign out', { feature: 'PersonalInfoScreen', error: error instanceof Error ? error : new Error(String(error)) });
    }
  };

  const handleDeleteAccountPress = (): void => {
    trackAmplitudeEvent('account_deletion_button_clicked', {
      email: user?.email || '[no_email]',
      screen: 'personal_info',
    });
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = (): void => {
    // Prevent closing modal while deletion is in progress
    if (isDeleting) {
      return;
    }
    // Dismiss keyboard with animation before closing modal
    KeyboardController.dismiss();
    
    setShowDeleteModal(false);
    setDeleteConfirmationText('');
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (deleteConfirmationText !== 'DELETE MY ACCOUNT') {
      Alert.alert('Invalid Confirmation', 'Please type "DELETE MY ACCOUNT" exactly to confirm.');
      return;
    }

    // Dismiss keyboard before proceeding to prevent double-tap issue
    KeyboardController.dismiss();

    setIsDeleting(true);

    try {
      trackAmplitudeEvent('account_deletion_initiated', {
        email: user?.email || '[no_email]',
      });

      logger.info('Starting account deletion', { 
        feature: 'PersonalInfoScreen',
        userId: user?.id,
      });

      const result = await deleteAccount(deleteConfirmationText);

      if (result.success) {
        trackAmplitudeEvent('account_deletion_completed', {
          email: user?.email || '[no_email]',
        });

        logger.info('Account deletion completed successfully', { 
          feature: 'PersonalInfoScreen',
        });

        // Close modal
        setShowDeleteModal(false);
        setDeleteConfirmationText('');

        // Show success toast
        showToast('Account successfully deleted. You will be signed out now.');

        // Redirect to welcome screen immediately
        // AuthContext will automatically handle the deleted auth account
        router.replace('/(auth)/welcome');

        // Try to clean up session (will likely fail as account is deleted, but that's okay)
        setTimeout(async () => {
          try {
            await signOut();
          } catch (error) {
            // Ignore signout errors as account is already deleted
            logger.info('Sign out after deletion (expected to fail)', { feature: 'PersonalInfoScreen' });
          }
        }, 100);
      } else {
        trackAmplitudeEvent('account_deletion_failed', {
          email: user?.email || '[no_email]',
          error: result.error,
        });

        logger.error('Account deletion failed', { 
          feature: 'PersonalInfoScreen',
          error: result.error,
        });

        Alert.alert(
          'Deletion Failed',
          result.error || 'Failed to delete account. Please try again or contact support.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      trackAmplitudeEvent('account_deletion_failed', {
        email: user?.email || '[no_email]',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      logger.error('Account deletion error', { 
        feature: 'PersonalInfoScreen',
        error: error instanceof Error ? error : new Error(String(error)),
      });

      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBlurName = async (): Promise<void> => {
    setIsEditingName(false);
    if (name !== profile?.displayName) {
      try {
        await updateProfile({ displayName: name });
        trackAmplitudeEvent('personal_info_field_edited', {
          field: 'displayName',
        });
      } catch (err) {
        logger.error('Failed to update name', { feature: 'PersonalInfoScreen', error: err instanceof Error ? err : new Error(String(err)) });
        Alert.alert('Error', 'Failed to save name. Please try again.');
      }
    }
  };

  const saveAllFields = async (): Promise<void> => {
    if (name !== profile?.displayName) {
      try {
        await updateProfile({ displayName: name });
      } catch (err) {
        logger.error('Failed to save fields', { feature: 'PersonalInfoScreen', error: err instanceof Error ? err : new Error(String(err)) });
      }
    }
  };

  useEffect(() => {
    return () => {
      if (isEditingName) {
        saveAllFields();
      }
    };
  }, [isEditingName, name]);

  // Format joined date
  const formatJoinedDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Format relative time (e.g., "2 days ago", "5 hours ago")
  const formatUpdateTimeAgo = (date: Date | null): string => {
    if (!date) {
      return 'N/A';
    }
    try {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);
      const diffWeeks = Math.floor(diffDays / 7);
      const diffMonths = Math.floor(diffDays / 30);
      const diffYears = Math.floor(diffDays / 365);

      if (diffYears > 0) {
        return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
      } else if (diffMonths > 0) {
        return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
      } else if (diffWeeks > 0) {
        return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
      } else if (diffDays > 0) {
        return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
      } else if (diffHours > 0) {
        return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
      } else if (diffMinutes > 0) {
        return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
      } else {
        return 'Just now';
      }
    } catch {
      return 'N/A';
    }
  };

  // Format app first install time as relative time
  const formatAppInstallTimeAgo = (timestamp: number | null): string => {
    if (!timestamp) {
      return 'N/A';
    }
    try {
      const date = new Date(timestamp);
      return formatUpdateTimeAgo(date);
    } catch {
      return 'N/A';
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]} testID="personal-info-loading">
        <ActivityIndicator size="large" color="#B6D95C" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]} testID="personal-info-error">
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorHint}>Please check your connection or try again later.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="personal-info-container">
      <KeyboardAwareScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        bottomOffset={KEYBOARD_AWARE_SCROLL_OFFSET}
        testID="personal-info-scroll"
      >
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
                  <Text style={styles.value} testID="value-name">{name || 'Not set'}</Text>
                )}
              </View>
            </Pressable>

            <View style={styles.infoItem} testID="info-item-email">
              <View style={styles.iconContainer} testID="icon-container-email">
                <FontAwesome name="envelope" size={20} color="#666" testID="icon-email" />
              </View>
              <View style={styles.infoContent} testID="info-content-email">
                <Text style={styles.label} testID="label-email">Email</Text>
                <Text style={styles.value} testID="value-email">{profile?.email || user?.email || 'Not set'}</Text>
              </View>
            </View>

            <View style={[styles.infoItem, styles.lastInfoItem]} testID="info-item-joined">
              <View style={styles.iconContainer} testID="icon-container-joined">
                <FontAwesome name="calendar" size={20} color="#666" testID="icon-joined" />
              </View>
              <View style={styles.infoContent} testID="info-content-joined">
                <Text style={styles.label} testID="label-joined">Joined at</Text>
                <Text style={styles.value} testID="value-joined">
                  {profile?.createdAt ? formatJoinedDate(profile.createdAt) : 'Not set'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.versionBlock} testID="version-block">
            <View style={styles.versionItem} testID="version-item-platform">
              <Text style={styles.versionLabel} testID="version-label-platform">Platform</Text>
              <Text style={styles.versionValue} testID="version-value-platform">
                {DeviceInfo.getSystemName()} {DeviceInfo.getSystemVersion()}
              </Text>
            </View>
            
            <View style={styles.versionItem} testID="version-item-app">
              <Text style={styles.versionLabel} testID="version-label-app">App Version</Text>
              <Text style={styles.versionValue} testID="version-value-app">
                {Constants.expoConfig?.version || '1.0.0'}
              </Text>
            </View>
            
            <View style={styles.versionItem} testID="version-item-app-install-time-ago">
              <Text style={styles.versionLabel} testID="version-label-app-install-time-ago">App Installed</Text>
              <Text style={styles.versionValue} testID="version-value-app-install-time-ago">
                {formatAppInstallTimeAgo(lastAppUpdateTime)}
              </Text>
            </View>
            
            <View style={styles.versionItem} testID="version-item-channel">
              <Text style={styles.versionLabel} testID="version-label-channel">Channel</Text>
              <Text style={styles.versionValue} testID="version-value-channel">
                {Updates.channel || 'none'}
              </Text>
            </View>
            
            <Pressable
              style={styles.versionItem}
              onPress={handleCopyUpdateId}
              testID="version-item-update"
            >
              <Text style={styles.versionLabel} testID="version-label-update">Update ID</Text>
              <Text style={styles.versionValue} testID="version-value-update">
                {Updates.updateId ? Updates.updateId.substring(0, 12) + '...' : 'embedded'}
              </Text>
            </Pressable>
            
            <View style={[styles.versionItem, styles.lastVersionItem]} testID="version-item-update-time-ago">
              <Text style={styles.versionLabel} testID="version-label-update-time-ago">Update Received</Text>
              <Text style={styles.versionValue} testID="version-value-update-time-ago">
                {formatUpdateTimeAgo(Updates.createdAt)}
              </Text>
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

          <Pressable
            style={({ pressed }) => [
              styles.deleteAccountButton,
              pressed && styles.buttonPressed
            ]}
            onPress={handleDeleteAccountPress}
            testID="delete-account-button"
          >
            <Text style={styles.deleteAccountButtonText} testID="delete-account-button-text">Delete my account</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 40) }]} testID="footer">
        <Pressable onPress={openPrivacyPolicy} testID="footer-privacy-button">
          <Text style={styles.footerLink} testID="footer-privacy-text">Privacy policy</Text>
        </Pressable>
        <Pressable onPress={openTermsOfService} testID="footer-terms-button">
          <Text style={styles.footerLink} testID="footer-terms-text">Terms of service</Text>
        </Pressable>
      </View>

      {/* Account deletion confirmation modal */}
      <Modal
        isVisible={showDeleteModal}
        onBackdropPress={isDeleting ? undefined : handleCloseDeleteModal}
        onSwipeComplete={isDeleting ? undefined : handleCloseDeleteModal}
        swipeDirection={isDeleting ? undefined : ['down']}
        style={styles.modal}
        propagateSwipe
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.5}
      >
        <KeyboardAwareScrollView
          style={styles.modalContent}
          contentContainerStyle={styles.modalContentContainer}
          showsVerticalScrollIndicator={false}
          testID="delete-account-modal"
        >
          <Text style={styles.modalTitle} testID="modal-title">Delete Account</Text>
          
          <Text style={styles.modalWarning} testID="modal-warning">
            ⚠️ This action cannot be undone
          </Text>
          
          <Text style={styles.modalDescription} testID="modal-description">
            All your data will be permanently deleted:{'\n'}
            • Your profile and personal information{'\n'}
            • All bosses and their information{'\n'}
            • All timeline entries and notes{'\n'}
            • All chat conversations{'\n'}
            • Your active subscription will be cancelled
          </Text>
          
          <Text style={styles.modalInstruction} testID="modal-instruction">
            Type <Text style={styles.modalInstructionBold}>DELETE MY ACCOUNT</Text> to confirm:
          </Text>
          
          <TextInput
            style={[styles.modalInput, { outlineStyle: 'none' } as any]}
            value={deleteConfirmationText}
            onChangeText={setDeleteConfirmationText}
            placeholder="DELETE MY ACCOUNT"
            placeholderTextColor="#999"
            autoCapitalize="characters"
            editable={!isDeleting}
            testID="delete-confirmation-input"
          />
          
          <View style={styles.modalButtons} testID="modal-buttons">
            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                styles.modalCancelButton,
                pressed && styles.buttonPressed,
                isDeleting && styles.buttonDisabled
              ]}
              onPress={handleCloseDeleteModal}
              disabled={isDeleting}
              testID="modal-cancel-button"
            >
              <Text style={styles.modalCancelButtonText} testID="modal-cancel-text">Cancel</Text>
            </Pressable>
            
            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                styles.modalDeleteButton,
                pressed && styles.buttonPressed,
                (deleteConfirmationText !== 'DELETE MY ACCOUNT' || isDeleting) && styles.buttonDisabled
              ]}
              onPress={handleConfirmDelete}
              disabled={deleteConfirmationText !== 'DELETE MY ACCOUNT' || isDeleting}
              testID="modal-confirm-button"
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#fff" testID="modal-deleting-spinner" />
              ) : (
                <Text style={styles.modalDeleteButtonText} testID="modal-confirm-text">
                  Delete Account
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAwareScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F1E8',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontFamily: 'Manrope-Regular',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Manrope-SemiBold',
  },
  errorHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontFamily: 'Manrope-Regular',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 70,
    flexGrow: 1,
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
    backgroundColor: '#F5F1E8',
  },
  footerLink: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Manrope-Regular',
  },
  versionBlock: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 24,
  },
  versionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lastVersionItem: {
    borderBottomWidth: 0,
  },
  versionLabel: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Manrope-Regular',
  },
  versionValue: {
    fontSize: 16,
    color: '#999',
    fontFamily: 'Manrope-Regular',
  },
  deleteAccountButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  deleteAccountButtonText: {
    color: '#ff3b30',
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modal: {
    margin: 20,
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalContentContainer: {
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Manrope-Bold',
  },
  modalWarning: {
    fontSize: 18,
    color: '#ff3b30',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Manrope-SemiBold',
  },
  modalDescription: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
    fontFamily: 'Manrope-Regular',
  },
  modalInstruction: {
    fontSize: 15,
    color: '#333',
    marginBottom: 12,
    fontFamily: 'Manrope-Regular',
  },
  modalInstructionBold: {
    fontWeight: 'bold',
    fontFamily: 'Manrope-Bold',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 24,
    fontFamily: 'Manrope-Regular',
    backgroundColor: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalCancelButton: {
    backgroundColor: '#f0f0f0',
  },
  modalCancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  modalDeleteButton: {
    backgroundColor: '#ff3b30',
  },
  modalDeleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
});

