import { BackArrowIcon } from '@/components/icons/BackArrowIcon';
import { AppColors } from '@/constants/Colors';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { NotificationOnboardingProvider, useNotificationOnboarding } from '@/contexts/NotificationOnboardingContext';
import { SessionProvider } from '@/contexts/SessionContext';
import { TrackingOnboardingProvider, useTrackingOnboarding } from '@/contexts/TrackingOnboardingContext';
import { initializeAmplitude } from '@/services/amplitude.service';
import { getAttributionData, getAttributionEmail, isFirstLaunch, markAppAsLaunched, saveAttributionData, setNeedsTrackingAfterAuth } from '@/services/attribution.service';
import { getCurrentUser, initializeGoogleSignIn } from '@/services/auth.service';
import { initializeFacebookSdk, parseDeepLinkParams, sendAppInstallEventDual, sendAppLaunchEventDual } from '@/services/facebook.service';
import { initializeIntercom } from '@/services/intercom.service';
import { logger } from '@/services/logger.service';
import { hasFacebookAttribution } from '@/services/tracking.service';
import { Lobster_400Regular } from '@expo-google-fonts/lobster';
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function HeaderBackButton(): React.JSX.Element {
  const router = useRouter();
  
  return (
    <TouchableOpacity 
      style={headerStyles.backButton}
      onPress={() => router.back()}
      testID="header-back-button"
    >
      <BackArrowIcon size={24} color="#161616" opacity={1} />
    </TouchableOpacity>
  );
}

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

  // Initialize Sentry, Facebook SDK, Intercom, Amplitude and handle attribution on first launch
  useEffect(() => {
    const initializeFacebookAndAttribution = async (): Promise<void> => {
      try {
        // Initialize Sentry first (before other SDKs so it can catch their errors)
        // The logger.init() already initializes Sentry with graceful fallback
        // This is just to ensure it's initialized early in the app lifecycle
        logger.info('App initialization started', { feature: 'App' });

        // Initialize Facebook SDK
        if (Platform.OS !== 'web') {
          await initializeFacebookSdk();
        }

        // Initialize Intercom SDK
        await initializeIntercom();

        // Initialize Amplitude SDK (works on all platforms)
        await initializeAmplitude();

        // Initialize Google Sign-In (iOS/Android only)
        initializeGoogleSignIn();

        // Setup Android notification handler and channel
        if (Platform.OS === 'android') {
          // Set notification handler
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
              shouldShowBanner: true,
              shouldShowList: true,
            }),
          });
          
          // Create default notification channel (required for Android 13+ permission dialog)
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default Notifications',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#8BC34A',
          });

          // Create chat messages notification channel (for FCM push notifications)
          await Notifications.setNotificationChannelAsync('chat_messages', {
            name: 'Chat Messages',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#8BC34A',
            sound: 'default',
            enableVibrate: true,
          });

          logger.info('Android notification handler and channels initialized', { feature: 'App' });
        }

        // Check if this is the first launch
        const firstLaunch = await isFirstLaunch();
        
        if (firstLaunch) {
          logger.info('First launch detected, checking for attribution data', { feature: 'App' });
          
          // ============================================================
          // TRACKING FLOW DECISION POINT
          // ============================================================
          //
          // SPECIAL CASE: Facebook Attribution (paid acquisition)
          //   → Request tracking IMMEDIATELY (before login)
          //   → Send events with attribution data (fbclid, utm params)
          //   → Implemented below for iOS/Android
          //
          // MAIN FLOW: Organic Users (App Store, referrals, etc)
          //   → Set flag to request tracking AFTER LOGIN
          //   → Send events with email after authentication
          //   → Implemented in services/auth.service.ts (all login methods)
          //
          // ============================================================
          
          // Get the initial URL (deep link)
          const initialUrl = await Linking.getInitialURL();
          
          if (initialUrl) {
            logger.info('Initial URL detected on first launch', { feature: 'App', initialUrl });
            
            // Parse attribution parameters
            const attributionData = parseDeepLinkParams(initialUrl);
            
            // Save attribution data to AsyncStorage
            await saveAttributionData(attributionData);
            
            // Check if we have Facebook attribution
            const hasFbAttribution = hasFacebookAttribution(attributionData);
            
            if (hasFbAttribution) {
              // ============================================================
              // SPECIAL CASE: Facebook Attribution Flow
              // ============================================================
              // User came from Facebook ad with attribution data (fbclid, utm params)
              // Show tracking onboarding immediately and send events with attribution
              
              if (Platform.OS === 'ios') {
                // iOS: tracking onboarding will handle permission request and event sending
                logger.info('iOS: Facebook attribution detected, tracking onboarding will handle events', { feature: 'App' });
              } else {
                // Android: send install event immediately (no ATT permission needed, tracking assumed enabled)
                logger.info('Android: Facebook attribution detected, sending app install event', { feature: 'App' });
                await sendAppInstallEventDual(
                  attributionData,
                  attributionData.email ? { email: attributionData.email } : undefined
                );
              }
            } else {
              // ============================================================
              // MAIN FLOW: Organic User Flow
              // ============================================================
              // User installed organically (no Facebook attribution)
              // Wait for them to log in, then show tracking onboarding
              // See: services/auth.service.ts for post-login tracking implementation
              
              logger.info('No Facebook attribution detected (organic install), will show tracking after login', { feature: 'App' });
              await setNeedsTrackingAfterAuth(true);
            }
          } else {
            // ============================================================
            // MAIN FLOW: No deep link (organic install)
            // ============================================================
            // User opened app directly without any deep link
            // Wait for them to log in, then show tracking onboarding
            // See: services/auth.service.ts for post-login tracking implementation
            
            logger.info('No initial URL detected (organic install), will show tracking after login', { feature: 'App' });
            await setNeedsTrackingAfterAuth(true);
          }
          
          // Mark app as launched
          await markAppAsLaunched();
        } else {
          // Not first launch - send App Launch event for returning user
          if (Platform.OS !== 'web') {
            logger.info('Subsequent launch detected', { feature: 'App' });
            
            try {
              const currentUser = getCurrentUser();
              const attributionData = await getAttributionData();
              
              // Send app launch event (client + server with event deduplication)
              await sendAppLaunchEventDual(
                attributionData || undefined,
                currentUser?.email ? { email: currentUser.email } : undefined
              );
              
              logger.info('App Launch event sent', { 
                feature: 'App', 
                hasUserEmail: !!currentUser?.email,
                hasAttribution: !!attributionData
              });
            } catch (launchError) {
              logger.error('Failed to send App Launch event', { feature: 'App', error: launchError instanceof Error ? launchError : new Error(String(launchError)) });
              // Don't block app initialization
            }
          }
        }
      } catch (initError) {
        logger.error('Failed to initialize Facebook SDK or attribution', { feature: 'App', error: initError instanceof Error ? initError : new Error(String(initError)) });
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
    <SafeAreaProvider>
      <SessionProvider>
        <AuthProvider>
          <TrackingOnboardingProvider>
            <NotificationOnboardingProvider>
              <RootLayoutNav />
            </NotificationOnboardingProvider>
          </TrackingOnboardingProvider>
        </AuthProvider>
      </SessionProvider>
      <Toast />
    </SafeAreaProvider>
  );
}

function RootLayoutNav() {
  const { authState, user } = useAuth();
  const { shouldShowOnboarding: shouldShowNotificationOnboarding } = useNotificationOnboarding();
  const { shouldShowOnboarding: shouldShowTrackingOnboarding } = useTrackingOnboarding();
  const segments = useSegments();
  const router = useRouter();
  const hasCheckedAttribution = useRef<boolean>(false);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  // Set or clear user context in Sentry when auth state changes
  useEffect(() => {
    if (authState === 'authenticated' && user) {
      logger.setUserContext(user.id, user.email || undefined);
    } else if (authState === 'unauthenticated') {
      logger.clearUserContext();
    }
  }, [authState, user]);

  // Register FCM token on app start if permission is granted
  useEffect(() => {
    if (!user) return;

    const registerToken = async () => {
      try {
        const { getNotificationPermissionStatus, registerFCMToken, setupFCMTokenRefreshListener } = 
          await import('@/services/notification.service');
        
        const status = await getNotificationPermissionStatus();
        if (status === 'granted') {
          await registerFCMToken(user.id);
          
          // Setup listener for token refresh
          const unsubscribe = setupFCMTokenRefreshListener(user.id);
          return unsubscribe;
        }
      } catch (error) {
        logger.error('Failed to register FCM token on app start', { feature: 'RootLayout', error });
      }
      return null;
    };

    const unsubscribePromise = registerToken();

    return () => {
      unsubscribePromise.then((unsubscribe) => {
        if (unsubscribe) {
          unsubscribe();
        }
      });
    };
  }, [user]);

  // Check for attribution email (only once when unauthenticated and not showing tracking onboarding)
  useEffect(() => {
    if (authState === 'unauthenticated' && !hasCheckedAttribution.current && !shouldShowTrackingOnboarding) {
      const checkAttributionEmail = async () => {
        hasCheckedAttribution.current = true;
        
        try {
          const attributionEmail = await getAttributionEmail();
          if (attributionEmail) {
            logger.info('Attribution email found, setting redirect to welcome', { feature: 'App', attributionEmail });
            setRedirectPath(`/(auth)/welcome?email=${encodeURIComponent(attributionEmail)}`);
          }
        } catch (error) {
          logger.error('Failed to check attribution email', { feature: 'App', error: error instanceof Error ? error : new Error(String(error)) });
        }
      };
      
      checkAttributionEmail();
    }
  }, [authState, shouldShowTrackingOnboarding]);

  // Handle routing logic based on auth state and required onboarding steps
  useEffect(() => {
    if (authState === 'loading') {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inNotificationOnboarding = segments[0] === 'notification-onboarding';
    const inTrackingOnboarding = segments[0] === 'tracking-onboarding';
    const inTabs = segments[0] === '(tabs)';
    const inRootScreen = ['personal-info', 'subscription', 'support', 'chat'].includes(segments[0] as string);
    
    // Determine where the user should be
    let targetPath: string | null = null;
    
    // First priority: tracking onboarding (iOS + Facebook attribution)
    if (shouldShowTrackingOnboarding) {
      if (!inTrackingOnboarding) {
        targetPath = '/tracking-onboarding';
      }
      // If already in tracking onboarding, do nothing
    }
    // Second priority: authenticated user flow
    else if (authState === 'authenticated') {
      // Notification onboarding now triggered by chat button, not automatically after login
      if (!inTabs && !inNotificationOnboarding && !inRootScreen) {
        // Only redirect to tabs if not already there, in notification onboarding, or in a root screen
        targetPath = '/(tabs)';
      }
    }
    // Third priority: unauthenticated user flow
    else if (authState === 'unauthenticated') {
      // Attribution email redirect takes precedence over welcome screen
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
      logger.info('Routing to new screen', { feature: 'App', targetPath, from: segments[0] || 'root' });
      router.replace(targetPath as any);
    }
  }, [authState, segments, shouldShowTrackingOnboarding, redirectPath]);

  // Handle notification tap - redirect to chat (when app is in foreground)
  useEffect(() => {
    if (Platform.OS === 'web' || !Notifications) return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      
      // Check if it's a chat message notification
      if (data?.type === 'chat_message') {
        logger.info('User tapped on chat notification', { 
          feature: 'RootLayout', 
          threadId: data.threadId 
        });
        
        // Navigate to chat screen
        router.push('/chat');
      }
    });

    return () => subscription.remove();
  }, [router]);

  // Handle notification that opened the app from quit/background state
  useEffect(() => {
    if (Platform.OS === 'web' || !Notifications) return;

    // Check if app was opened by notification tap
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        
        const data = response.notification.request.content.data;
        
        if (data?.type === 'chat_message') {
          logger.info('App opened from chat notification', { 
            feature: 'RootLayout', 
            threadId: data.threadId 
          });
          
          // Navigate to chat screen
          router.push('/chat');
        }
      })
      .catch((error) => {
        logger.error('Error checking initial notification', { 
          feature: 'RootLayout', 
          error 
        });
      });
  }, [router]);

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
        <Stack.Screen 
          name="chat" 
          options={{ 
            headerShown: true,
            presentation: 'card',
            title: 'BossUp',
            headerBackTitle: '',
            headerShadowVisible: false,
            headerTitleAlign: 'center',
            headerStyle: {
              backgroundColor: '#F5F1E8',
            },
            headerTintColor: '#000',
            headerTitleStyle: {
              color: '#000',
              fontSize: 16,
              fontFamily: 'Manrope-Regular',
            },
            headerLeft: () => <HeaderBackButton />,
            headerTransparent: false,
            headerBlurEffect: 'none',
          }} 
        />
        <Stack.Screen 
          name="personal-info" 
          options={{ 
            headerShown: true,
            presentation: 'card',
            title: 'Personal information',
            headerBackTitle: '',
            headerShadowVisible: false,
            headerTitleAlign: 'center',
            headerStyle: {
              backgroundColor: '#F5F1E8',
            },
            headerTintColor: '#000',
            headerTitleStyle: {
              color: '#000',
              fontSize: 16,
              fontFamily: 'Manrope-Regular',
            },
            headerLeft: () => <HeaderBackButton />,
            headerTransparent: false,
            headerBlurEffect: 'none',
          }} 
        />
        <Stack.Screen 
          name="subscription" 
          options={{ 
            headerShown: true,
            presentation: 'card',
            title: 'Subscription',
            headerBackTitle: '',
            headerShadowVisible: false,
            headerTitleAlign: 'center',
            headerStyle: {
              backgroundColor: '#F5F1E8',
            },
            headerTintColor: '#000',
            headerTitleStyle: {
              color: '#000',
              fontSize: 16,
              fontFamily: 'Manrope-Regular',
            },
            headerLeft: () => <HeaderBackButton />,
            headerTransparent: false,
            headerBlurEffect: 'none',
          }} 
        />
      </Stack>
    </ThemeProvider>
  );
}

const headerStyles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
