import { useAuth } from '@/contexts/AuthContext';
import { AttributionData } from '@/services/attribution.service';
import { hasFacebookAttribution, shouldShowFirstLaunchTracking, shouldShowTrackingOnboarding } from '@/services/tracking.service';
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
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);
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

  // Check if this is first launch and we should show tracking permission
  const hasCheckedFirstLaunchRef = useRef(false);
  
  const checkFirstLaunch = async (): Promise<void> => {
    try {
      // Prevent multiple calls
      if (hasCheckedFirstLaunchRef.current) {
        console.log('[TrackingOnboarding] Already checked first launch, skipping');
        return;
      }
      
      hasCheckedFirstLaunchRef.current = true;
      const shouldShow = await shouldShowFirstLaunchTracking();
      setIsFirstLaunch(shouldShow);
      
      if (shouldShow) {
        console.log('[TrackingOnboarding] First launch detected, will show tracking onboarding');
        setShouldShowOnboarding(true);
      } else {
        console.log('[TrackingOnboarding] Not first launch or tracking already determined');
        setShouldShowOnboarding(false);
      }
    } catch (error) {
      console.error('[TrackingOnboarding] Error checking first launch:', error);
      setShouldShowOnboarding(false);
    }
  };

  // Function to check if we have attribution data and should show ATT
  const checkAttributionAndShowTracking = (attributionData: AttributionData): void => {
    const hasFbAttribution = hasFacebookAttribution(attributionData);
    
    if (hasFbAttribution && isFirstLaunch) {
      console.log('[TrackingOnboarding] Facebook attribution detected, showing tracking onboarding');
      setShouldShowOnboarding(true);
    }
  };

  // On mount, check if we should show the onboarding
  const hasInitializedRef = useRef(false);
  
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      checkFirstLaunch();
    }
  }, []);

  // When auth state changes, check if we should show onboarding for logged in user
  useEffect(() => {
    if (authState === 'authenticated' && user && !hasCheckedOnboarding) {
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
