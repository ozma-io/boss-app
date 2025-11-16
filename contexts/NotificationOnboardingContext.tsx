import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/services/logger.service';
import { shouldShowNotificationOnboarding } from '@/services/user.service';
import React, { createContext, useContext, useState } from 'react';

interface NotificationOnboardingContextType {
  shouldShowOnboarding: boolean;
  setShouldShowOnboarding: (value: boolean) => void;
}

const NotificationOnboardingContext = createContext<NotificationOnboardingContextType | undefined>(undefined);

interface NotificationOnboardingProviderProps {
  children: React.ReactNode;
}

export function NotificationOnboardingProvider({ children }: NotificationOnboardingProviderProps): React.JSX.Element {
  const { user } = useAuth();
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);

  const checkShouldShowOnboarding = async (): Promise<void> => {
    if (!user) {
      setShouldShowOnboarding(false);
      return;
    }

    logger.time('NotificationOnboarding-check');

    try {
      const shouldShow = await shouldShowNotificationOnboarding(user.id);
      logger.timeEnd('NotificationOnboarding-check', { feature: 'NotificationOnboarding', userId: user.id, shouldShow });
      setShouldShowOnboarding(shouldShow);
    } catch (error) {
      logger.timeEnd('NotificationOnboarding-check', { feature: 'NotificationOnboarding', userId: user.id });
      logger.warn('Failed to check notification onboarding', { feature: 'NotificationOnboarding', error });
      setShouldShowOnboarding(false);
    }
  };

  // Automatic check after login removed - notification onboarding now triggered by chat button
  // useEffect(() => {
  //   if (authState === 'authenticated' && user && !hasCheckedOnboarding) {
  //     checkShouldShowOnboarding();
  //     setHasCheckedOnboarding(true);
  //   } else if (authState === 'unauthenticated') {
  //     setShouldShowOnboarding(false);
  //     setHasCheckedOnboarding(false);
  //   }
  // }, [authState, user, hasCheckedOnboarding]);

  // AppState listener removed - notification onboarding now triggered by chat button
  // useEffect(() => {
  //   const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
  //     if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
  //       if (authState === 'authenticated' && user) {
  //         checkShouldShowOnboarding();
  //       }
  //     }
  //     appState.current = nextAppState;
  //   });

  //   return () => {
  //     subscription.remove();
  //   };
  // }, [authState, user]);

  return (
    <NotificationOnboardingContext.Provider value={{ shouldShowOnboarding, setShouldShowOnboarding }}>
      {children}
    </NotificationOnboardingContext.Provider>
  );
}

export function useNotificationOnboarding(): NotificationOnboardingContextType {
  const context = useContext(NotificationOnboardingContext);
  if (context === undefined) {
    throw new Error('useNotificationOnboarding must be used within a NotificationOnboardingProvider');
  }
  return context;
}

