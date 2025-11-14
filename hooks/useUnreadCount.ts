import { db } from '@/constants/firebase.config';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/services/logger.service';
import { ChatThread } from '@/types';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Only import on native platforms
let Notifications: any = null;
if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
}

/**
 * Hook to subscribe to unread message count for the main chat thread
 * 
 * Features:
 * - Real-time updates via Firestore onSnapshot
 * - Automatically updates app icon badge count
 * - Returns current unread count for UI display
 * 
 * @returns Current unread count (0 if not available)
 */
export function useUnreadCount(): number {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const threadId = 'main'; // Single thread per user for MVP
    const threadRef = doc(db, 'users', user.id, 'chatThreads', threadId);

    logger.debug('Subscribing to unread count', { 
      feature: 'useUnreadCount', 
      userId: user.id, 
      threadId 
    });

    const unsubscribe = onSnapshot(
      threadRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const threadData = docSnapshot.data() as ChatThread;
          const count = threadData.unreadCount || 0;
          
          setUnreadCount(count);
          
          // Update app icon badge
          if (Platform.OS !== 'web' && Notifications) {
            Notifications.setBadgeCountAsync(count).catch((error: Error) => {
              logger.error('Failed to set badge count', {
                feature: 'useUnreadCount',
                userId: user.id,
                count,
                error,
              });
            });
          }
          
          logger.debug('Unread count updated', {
            feature: 'useUnreadCount',
            userId: user.id,
            threadId,
            count,
          });
        } else {
          setUnreadCount(0);
        }
      },
      (error) => {
        logger.error('Error in unread count subscription', {
          feature: 'useUnreadCount',
          userId: user.id,
          threadId,
          error,
        });
        setUnreadCount(0);
      }
    );

    return () => {
      logger.debug('Unsubscribing from unread count', {
        feature: 'useUnreadCount',
        userId: user.id,
        threadId,
      });
      unsubscribe();
    };
  }, [user]);

  return unreadCount;
}

