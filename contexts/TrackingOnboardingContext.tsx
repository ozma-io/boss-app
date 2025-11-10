import { useAuth } from '@/contexts/AuthContext';
import { AttributionData } from '@/services/attribution.service';
import { shouldShowTrackingOnboarding, syncTrackingStatusIfNeeded } from '@/services/tracking.service';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface TrackingOnboardingContextType {
  shouldShowOnboarding: boolean;
  setShouldShowOnboarding: (value: boolean) => void;
  checkAttributionAndShowTracking: (attributionData: AttributionData) => void;
}

const TrackingOnboardingContext = createContext<TrackingOnboardingContextType | undefined>(undefined);

interface TrackingOnboardingProviderProps {
  children: React.ReactNode;
}

export function TrackingOnboardingProvider({ children }: TrackingOnboardingProviderProps): React.JSX.Element {
  const { user, authState } = useAuth();
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);
  const appState = useRef(AppState.currentState);

  // Check if we should show tracking onboarding for registered users
  const checkShouldShowOnboarding = async (): Promise<void> => {
    if (!user) {
      setShouldShowOnboarding(false);
      return;
    }

    const startTime = Date.now();
    console.log(`📱 [TrackingOnboarding] ======== START ======== User: ${user.id} at ${new Date().toISOString()}`);

    try {
      const shouldShow = await shouldShowTrackingOnboarding(user.id);
      const duration = Date.now() - startTime;
      console.log(`📱 [TrackingOnboarding] ======== RESULT: ${shouldShow ? 'SHOW' : 'SKIP'} ======== Duration: ${duration}ms`);
      setShouldShowOnboarding(shouldShow);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.warn(`📱 [TrackingOnboarding] ======== FAILED ======== Duration: ${duration}ms`, error);
      setShouldShowOnboarding(false);
    }
  };

  // NOTE: First launch tracking is now handled directly in _layout.tsx
  // This context only handles tracking onboarding for authenticated users (e.g., re-prompt after 2 weeks)
  
  // Function to check if we have attribution data and should show ATT
  // (kept for compatibility, but not used for first launch anymore)
  const checkAttributionAndShowTracking = (attributionData: AttributionData): void => {
    // No-op: First launch tracking is now handled in _layout.tsx
    console.log('[TrackingOnboarding] checkAttributionAndShowTracking called, but first launch is handled in _layout.tsx');
  };

  // When auth state changes, check if we should show onboarding for logged in user
  useEffect(() => {
    if (authState === 'authenticated' && user && !hasCheckedOnboarding) {
      // Sync tracking status with system first
      syncTrackingStatusIfNeeded(user.id);
      // Then check if we should show onboarding
      checkShouldShowOnboarding();
      setHasCheckedOnboarding(true);
    } else if (authState === 'unauthenticated') {
      // Don't reset shouldShowOnboarding here as we might need to show
      // the tracking screen for first launch even before authentication
      setHasCheckedOnboarding(false);
    }
  }, [authState, user, hasCheckedOnboarding]);

  // Check onboarding status when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (authState === 'authenticated' && user) {
          // Sync tracking status with system in case user changed it in Settings
          syncTrackingStatusIfNeeded(user.id);
          // Then check if we should show onboarding
          checkShouldShowOnboarding();
        }
        // Don't check first launch on app resume - only on initial mount
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [authState, user]);

  return (
    <TrackingOnboardingContext.Provider 
      value={{ 
        shouldShowOnboarding, 
        setShouldShowOnboarding,
        checkAttributionAndShowTracking 
      }}
    >
      {children}
    </TrackingOnboardingContext.Provider>
  );
}

export function useTrackingOnboarding(): TrackingOnboardingContextType {
  const context = useContext(TrackingOnboardingContext);
  if (context === undefined) {
    throw new Error('useTrackingOnboarding must be used within a TrackingOnboardingProvider');
  }
  return context;
}
