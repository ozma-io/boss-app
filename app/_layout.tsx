import { AppColors } from '@/constants/Colors';
import { functions } from '@/constants/firebase.config';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { NotificationOnboardingProvider, useNotificationOnboarding } from '@/contexts/NotificationOnboardingContext';
import { TrackingOnboardingProvider, useTrackingOnboarding } from '@/contexts/TrackingOnboardingContext';
import { getAttributionEmail, isFirstLaunch, markAppAsLaunched, saveAttributionData } from '@/services/attribution.service';
import { generateEventId, initializeFacebookSdk, logAppInstallEvent, parseDeepLinkParams } from '@/services/facebook.service';
import { Lobster_400Regular } from '@expo-google-fonts/lobster';
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';
import 'react-native-reanimated';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Lobster-Regular': Lobster_400Regular,
    'Manrope-Regular': Manrope_400Regular,
    'Manrope-SemiBold': Manrope_600SemiBold,
    'Manrope-Bold': Manrope_700Bold,
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Initialize Facebook SDK and handle attribution on first launch
  useEffect(() => {
    const initializeFacebookAndAttribution = async (): Promise<void> => {
      try {
        // Initialize Facebook SDK
        if (Platform.OS !== 'web') {
          await initializeFacebookSdk();
        }

        // Check if this is the first launch
        const firstLaunch = await isFirstLaunch();
        
        if (firstLaunch) {
          console.log('[App] First launch detected, checking for attribution data');
          
          // Get the initial URL (deep link)
          const initialUrl = await Linking.getInitialURL();
          
          if (initialUrl) {
            console.log('[App] Initial URL detected:', initialUrl);
            
            // Parse attribution parameters
            const attributionData = parseDeepLinkParams(initialUrl);
            
            // Save attribution data to AsyncStorage
            await saveAttributionData(attributionData);
            
            // We need to defer this call to the context's function until after mounting
            // The context will be available and we'll check for attribution data then
            
            // Send AppInstall event to Facebook (client-side)
            // Only if we're not on web platform
            if (Platform.OS !== 'web') {
              await logAppInstallEvent(attributionData);
            }
            
            // Send AppInstall event to Facebook (server-side via Cloud Function)
            try {
              const sendFacebookEvent = httpsCallable(functions, 'sendFacebookConversionEvent');
              const eventId = generateEventId();
              
              await sendFacebookEvent({
                eventName: 'AppInstall',
                eventTime: Math.floor(Date.now() / 1000),
                eventId: eventId,
                fbclid: attributionData.fbclid,
                userData: {
                  email: attributionData.email,
                },
                customData: {
                  utm_source: attributionData.utm_source,
                  utm_medium: attributionData.utm_medium,
                  utm_campaign: attributionData.utm_campaign,
                },
              });
              
              console.log('[App] Server-side AppInstall event sent successfully');
            } catch (serverError) {
              console.error('[App] Error sending server-side AppInstall event:', serverError);
            }
          }
          
          // Mark app as launched
          await markAppAsLaunched();
        }
      } catch (initError) {
        console.error('[App] Error initializing Facebook SDK or attribution:', initError);
      }
    };

    if (loaded) {
      initializeFacebookAndAttribution();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <TrackingOnboardingProvider>
        <NotificationOnboardingProvider>
          <RootLayoutNav />
        </NotificationOnboardingProvider>
      </TrackingOnboardingProvider>
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const { authState } = useAuth();
  const { shouldShowOnboarding: shouldShowNotificationOnboarding } = useNotificationOnboarding();
  const { shouldShowOnboarding: shouldShowTrackingOnboarding } = useTrackingOnboarding();
  const segments = useSegments();
  const router = useRouter();
  const hasCheckedAttribution = useRef<boolean>(false);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  // Check for attribution email (only once when unauthenticated)
  useEffect(() => {
    if (authState === 'unauthenticated' && !hasCheckedAttribution.current) {
      const checkAttributionEmail = async () => {
        hasCheckedAttribution.current = true;
        
        try {
          const attributionEmail = await getAttributionEmail();
          if (attributionEmail) {
            console.log('[App] Attribution email found, setting redirect to email-input');
            setRedirectPath(`/(auth)/email-input?email=${encodeURIComponent(attributionEmail)}`);
          }
        } catch (error) {
          console.error('[App] Error checking attribution email:', error);
        }
      };
      
      checkAttributionEmail();
    }
  }, [authState]);

  // Handle routing logic based on auth state and required onboarding steps
  useEffect(() => {
    if (authState === 'loading') {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inNotificationOnboarding = segments[0] === 'notification-onboarding';
    const inTrackingOnboarding = segments[0] === 'tracking-onboarding';
    const inTabs = segments[0] === '(tabs)';
    
    // Determine where the user should be
    let targetPath: string | null = null;
    
    // First priority: tracking onboarding (for any auth state)
    if (shouldShowTrackingOnboarding) {
      if (!inTrackingOnboarding) {
        targetPath = '/tracking-onboarding';
      }
      // If already in tracking onboarding, do nothing
    }
    // Second priority: authenticated user flow
    else if (authState === 'authenticated') {
      if (shouldShowNotificationOnboarding) {
        if (!inNotificationOnboarding) {
          targetPath = '/notification-onboarding';
        }
      } else if (!inTabs && !inNotificationOnboarding) {
        // Only redirect to tabs if not already there or in notification onboarding
        targetPath = '/(tabs)';
      }
    }
    // Third priority: unauthenticated user flow
    else if (authState === 'unauthenticated') {
      // Attribution email redirect takes precedence if set
      if (redirectPath) {
        targetPath = redirectPath;
        // Clear redirect after use
        setRedirectPath(null);
      }
      // Otherwise go to welcome page if not already in auth flow
      else if (!inAuthGroup && !inTrackingOnboarding) {
        targetPath = '/(auth)/welcome';
      }
    }
    
    // Navigate only if we have a target and it's different from where we are
    if (targetPath) {
      console.log(`[App] Routing to: ${targetPath} from ${segments[0] || 'root'}`);
      router.replace(targetPath as any);
    }
  }, [authState, segments, shouldShowNotificationOnboarding, shouldShowTrackingOnboarding, redirectPath]);

  if (authState === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: AppColors.background }} testID="auth-loading-container">
        <ActivityIndicator size="large" color={AppColors.loaderColor} testID="auth-loading-indicator" />
      </View>
    );
  }

  // Always use light theme for now, ignore system color scheme
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack>
        <Stack.Screen 
          name="(auth)" 
          options={{ 
            headerShown: false,
          }} 
        />
        <Stack.Screen 
          name="notification-onboarding"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen 
          name="tracking-onboarding"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
            title: '',
          }} 
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        <Stack.Screen 
          name="chat" 
          options={{ 
            headerShown: true, 
            title: '',
            headerBackTitle: 'Back',
          }} 
        />
        <Stack.Screen 
          name="personal-info" 
          options={{ 
            headerShown: true, 
            title: 'Personal information',
          }} 
        />
        <Stack.Screen 
          name="subscription" 
          options={{ 
            headerShown: true, 
            title: 'Subscription',
          }} 
        />
        <Stack.Screen 
          name="boss-timeline" 
          options={{ 
            headerShown: true, 
            title: 'Boss Timeline',
          }} 
        />
        <Stack.Screen 
          name="support" 
          options={{ 
            headerShown: true, 
            title: 'Support',
          }} 
        />
        <Stack.Screen name="boss-details" options={{ headerShown: true, title: 'Boss Details' }} />
        <Stack.Screen name="entry-details" options={{ headerShown: true, title: 'Entry Details' }} />
      </Stack>
    </ThemeProvider>
  );
}
