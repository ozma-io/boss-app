import { useAuth } from '@/contexts/AuthContext';
import { createBoss, getFirstBoss, subscribeToBoss, updateBoss as updateBossService } from '@/services/boss.service';
import { logger } from '@/services/logger.service';
import { Boss, BossUpdate } from '@/types';
import { useCallback, useEffect, useState } from 'react';

/**
 * Hook for managing boss data with real-time updates
 * 
 * Automatically loads the first boss for the authenticated user
 * and subscribes to real-time changes from Firestore. Handles
 * loading states, errors, and provides update functionality.
 * 
 * @returns Boss data, loading state, error, and update function
 * 
 * @example
 * ```tsx
 * function BossScreen() {
 *   const { boss, loading, error, updateBoss } = useBoss();
 *   
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage message={error} />;
 *   if (!boss) return <NoBossFound />;
 *   
 *   const handleUpdate = async () => {
 *     await updateBoss({ name: 'New Name' });
 *   };
 *   
 *   return <BossProfile boss={boss} onUpdate={handleUpdate} />;
 * }
 * ```
 */
export function useBoss(): {
  boss: Boss | null;
  loading: boolean;
  error: string | null;
  updateBoss: (data: BossUpdate) => Promise<void>;
} {
  const { user } = useAuth();
  const [boss, setBoss] = useState<Boss | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [bossId, setBossId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setError('User not authenticated');
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const loadAndSubscribe = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        // Load first boss
        let firstBoss = await getFirstBoss(user.id);

        // SAFETY FALLBACK: If no boss exists, create one
        // Normally boss is created explicitly at:
        // 1. Web-funnel: when user submits email (with onboarding data)
        // 2. App registration: in ensureUserProfileExists() when new user signs up
        // This fallback should rarely trigger but ensures the app never breaks
        if (!firstBoss) {
          // ⚠️ This should NOT happen in production - report to Sentry
          logger.error('FALLBACK TRIGGERED: No boss found for user (should be unreachable)', { 
            feature: 'useBoss', 
            userId: user.id,
            error: new Error('Boss creation fallback triggered - explicit creation failed'),
          });
          
          logger.info('Creating boss via fallback', { feature: 'useBoss', userId: user.id });
          const newBossId = await createBoss(user.id);
          
          logger.info('Boss created via fallback, syncing', { feature: 'useBoss', userId: user.id, bossId: newBossId });
          
          // Wait a bit for Firestore to sync
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Try to load the newly created boss
          firstBoss = await getFirstBoss(user.id);
          
          if (!firstBoss) {
            setError('Failed to create boss. Please try again.');
            setLoading(false);
            return;
          }
        }

        setBossId(firstBoss.id);

        // Subscribe to real-time updates
        unsubscribe = subscribeToBoss(user.id, firstBoss.id, (updatedBoss) => {
          if (updatedBoss) {
            setBoss(updatedBoss);
            setError(null);
          } else {
            setError('Boss not found');
            setBoss(null);
          }
          setLoading(false);
        });
      } catch (err) {
        logger.error('Failed to load boss', { feature: 'useBoss', userId: user.id, error: err instanceof Error ? err : new Error(String(err)) });
        setError('Failed to load boss data');
        setLoading(false);
      }
    };

    loadAndSubscribe();

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.id]);

  /**
   * Update boss data in Firestore
   * 
   * @param data - Partial boss data to update
   * @throws Error if update fails
   */
  const updateBoss = useCallback(
    async (data: BossUpdate): Promise<void> => {
      if (!user?.id || !bossId) {
        throw new Error('Cannot update boss: user or bossId not available');
      }

      await updateBossService(user.id, bossId, data);
    },
    [user?.id, bossId]
  );

  return {
    boss,
    loading,
    error,
    updateBoss,
  };
}

