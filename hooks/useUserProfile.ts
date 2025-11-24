import { useAuth } from '@/contexts/AuthContext';
import { subscribeToUserProfile, updateUserProfile as updateUserProfileService } from '@/services/user.service';
import { UserProfile, UserProfileUpdate } from '@/types';
import { useCallback, useEffect, useState } from 'react';

/**
 * Hook for managing user profile with real-time updates
 * 
 * Loads the authenticated user's profile and subscribes to
 * real-time changes from Firestore. Provides update functionality
 * for profile fields including custom fields (position, department,
 * goal). Automatically handles loading states and errors.
 * 
 * @returns Profile data, loading state, error, and update function
 * 
 * @example
 * ```tsx
 * function ProfileScreen() {
 *   const { profile, loading, error, updateProfile } = useUserProfile();
 *   
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage message={error} />;
 *   if (!profile) return <NoProfileFound />;
 *   
 *   const handleUpdateGoal = async (newGoal: string) => {
 *     await updateProfile({ custom_goal: newGoal });
 *   };
 *   
 *   return <ProfileView profile={profile} onUpdateGoal={handleUpdateGoal} />;
 * }
 * ```
 */
export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    // Subscribe to real-time profile updates
    const unsubscribe = subscribeToUserProfile(user.id, (updatedProfile) => {
      if (updatedProfile) {
        setProfile(updatedProfile);
        setError(null);
      } else {
        setError('Profile not found');
        setProfile(null);
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  /**
   * Update user profile data in Firestore
   * 
   * Supports updating core fields (displayName, photoURL) and
   * custom fields (custom_position, custom_department, custom_goal).
   * 
   * @param data - Partial profile data to update
   * @throws Error if update fails
   * 
   * @example
   * ```tsx
   * // Update custom field
   * await updateProfile({ custom_goal: 'Get promoted' });
   * 
   * // Update multiple fields
   * await updateProfile({
   *   displayName: 'John Doe',
   *   custom_position: 'Senior Developer',
   *   custom_department: 'Engineering'
   * });
   * ```
   */
  const updateProfile = useCallback(
    async (data: UserProfileUpdate): Promise<void> => {
      if (!user?.id) {
        throw new Error('Cannot update profile: user not authenticated');
      }

      await updateUserProfileService(user.id, data);
    },
    [user?.id]
  );

  return {
    profile,
    loading,
    error,
    updateProfile,
  };
}

