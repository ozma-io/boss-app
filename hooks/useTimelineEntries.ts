import { useAuth } from '@/contexts/AuthContext';
import { subscribeToTimelineEntries } from '@/services/timeline.service';
import { TimelineEntry } from '@/types';
import { useEffect, useState } from 'react';

/**
 * Hook for managing timeline entries with real-time updates
 * 
 * Loads timeline entries for a specific boss and subscribes
 * to real-time changes from Firestore. Automatically handles
 * loading states and errors. Entries are returned sorted by
 * timestamp (newest first).
 * 
 * @param bossId - Boss ID to load entries for (optional, waits if undefined)
 * @returns Timeline entries, loading state, and error
 * 
 * @example
 * ```tsx
 * function TimelineScreen() {
 *   const { boss } = useBoss();
 *   const { entries, loading, error } = useTimelineEntries(boss?.id);
 *   
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage message={error} />;
 *   if (entries.length === 0) return <EmptyState />;
 *   
 *   return <TimelineList entries={entries} />;
 * }
 * ```
 */
export function useTimelineEntries(bossId: string | undefined) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If no user, set error and stop loading
    if (!user?.id) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    // If no bossId yet, keep loading (boss is being created/loaded)
    if (!bossId) {
      setLoading(true);
      return;
    }

    // User and bossId are available, subscribe to entries
    setLoading(true);
    setError(null);

    // Subscribe to real-time updates
    const unsubscribe = subscribeToTimelineEntries(
      user.id,
      bossId,
      (updatedEntries) => {
        setEntries(updatedEntries);
        setLoading(false);
        
        // No explicit error set here as subscribeToTimelineEntries
        // already handles errors by returning empty array
        if (updatedEntries.length === 0) {
          console.log('[useTimelineEntries] No entries found or error occurred');
        }
      }
    );

    // Cleanup subscription on unmount or when dependencies change
    return () => {
      unsubscribe();
    };
  }, [user?.id, bossId]);

  return {
    entries,
    loading,
    error,
  };
}

