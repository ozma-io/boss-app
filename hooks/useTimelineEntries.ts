import { useAuth } from '@/contexts/AuthContext';
import { subscribeToTimelineEntries } from '@/services/timeline.service';
import { TimelineEntry } from '@/types';
import { logger } from '@/services/logger.service';
import { useEffect, useState } from 'react';

/**
 * Hook for managing timeline entries with real-time updates
 * 
 * Loads all timeline entries for the user and subscribes
 * to real-time changes from Firestore. Automatically handles
 * loading states and errors. Entries are returned sorted by
 * timestamp (newest first).
 * 
 * @returns Timeline entries, loading state, and error
 * 
 * @example
 * ```tsx
 * function TimelineScreen() {
 *   const { entries, loading, error } = useTimelineEntries();
 *   
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage message={error} />;
 *   if (entries.length === 0) return <EmptyState />;
 *   
 *   return <TimelineList entries={entries} />;
 * }
 * ```
 */
export function useTimelineEntries() {
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

    // User is available, subscribe to entries
    setLoading(true);
    setError(null);

    // Subscribe to real-time updates
    const unsubscribe = subscribeToTimelineEntries(
      user.id,
      (updatedEntries) => {
        setEntries(updatedEntries);
        setLoading(false);
        
        // No explicit error set here as subscribeToTimelineEntries
        // already handles errors by returning empty array
        if (updatedEntries.length === 0) {
          logger.info('No timeline entries found', { feature: 'useTimelineEntries', userId: user.id });
        }
      }
    );

    // Cleanup subscription on unmount or when dependencies change
    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  return {
    entries,
    loading,
    error,
  };
}

