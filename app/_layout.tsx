import { BackArrowIcon } from '@/components/icons/BackArrowIcon';
import { AppColors } from '@/constants/Colors';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { NotificationOnboardingProvider } from '@/contexts/NotificationOnboardingContext';
import { SessionProvider } from '@/contexts/SessionContext';
import { TrackingOnboardingProvider, useTrackingOnboarding } from '@/contexts/TrackingOnboardingContext';
import { useNotificationHandlers } from '@/hooks/useNotificationHandlers';
import { initializeAmplitude } from '@/services/amplitude.service';
import { getAttributionEmail, isAppInstallEventSent, markAppInstallEventSent, saveAttributionData } from '@/services/attribution.service';
import { initializeGoogleSignIn } from '@/services/auth.service';
import { parseDeepLinkParams, sendAppInstallEventDual } from '@/services/facebook.service';
import { initializeIntercom } from '@/services/intercom.service';
import { logger } from '@/services/logger.service';
import { hasFacebookAttribution } from '@/services/tracking.service';
import { updateUserPresence } from '@/services/user.service';
import { Lobster_400Regular } from '@expo-google-fonts/lobster';
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
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

function AnimatedLogo(): React.JSX.Element {
  const scale = useSharedValue(1);

  useEffect(() => {
    // Smooth breathing animation: scale from 1 to 1.08 and back
    // Duration: 2000ms for gentle, calm effect
    scale.value = withRepeat(
      withTiming(1.08, {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // Infinite repeat
      true // Reverse (go back to 1)
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Image
      source={require('../assets/images/icon.png')}
      style={[{ width: 120, height: 120, marginBottom: 20 }, animatedStyle]}
      testID="auth-loading-logo"
    />
  );
}

export default function RootLayout(): React.JSX.Element | null {
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

  // Initialize app: check for updates, initialize SDKs, handle attribution
  useEffect(() => {
    const initializeApp = async (): Promise<void> => {
      try {
        // Initialize Sentry first (before other SDKs so it can catch their errors)
        // The logger.init() already initializes Sentry with graceful fallback
        // This is just to ensure it's initialized early in the app lifecycle
        logger.info('App initialization started', { feature: 'App' });

        // ============================================================
        // CHECK FOR UPDATES (before showing any UI)
        // ============================================================
        // This ensures users always get the latest version before interacting with the app
        // Uses force=true to immediately reload with new update
        if (Platform.OS !== 'web') {
          const { checkAndApplyUpdates } = await import('@/services/updates.service');
          await checkAndApplyUpdates(true);
        }

        // Facebook SDK: Initializes automatically (isAutoInitEnabled: true in app.config.ts)
        // No manual initialization needed - SDK will start at native app launch
        // On iOS: setAdvertiserTrackingEnabled() will be called later after ATT permission

        // Initialize Intercom SDK
        await initializeIntercom();

        // Initialize Amplitude SDK (native platforms only)
        // Web: deferred until after authentication (see AuthContext.tsx)
        if (Platform.OS !== 'web') {
          await initializeAmplitude();
        }

        // Initialize Google Sign-In (iOS/Android only)
        initializeGoogleSignIn();

        // Setup Android-specific notification channels
        if (Platform.OS === 'android') {
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
            enableVibrate: true,
          });

          logger.info('Android notification channels initialized', { feature: 'App' });
        }

        // ============================================================
        // ATTRIBUTION DATA HANDLING & APP INSTALL EVENT
        // ============================================================
        //
        // Save attribution data from deep link to AsyncStorage
        // This data will be used for Facebook event tracking
        // 
        // APP INSTALL EVENT LOGIC:
        // - Scenario A: If attribution data is available at install time (fbclid, fbc, utm_source)
        //   → Send App Install event immediately (without userId, user hasn't logged in yet)
        // - Scenario B: If attribution data is NOT available at install time
        //   → Send App Install event after first login (with userId + email + Firestore attribution)
        //   → Implemented in auth.service.ts (Android) and tracking-onboarding.tsx (iOS)
        //
        // REGISTRATION EVENT (fb_mobile_complete_registration):
        // - Always sent at first login with userId + email + method
        // - Implemented in auth.service.ts → handlePostLoginTracking
        //
        // ============================================================
        
        // Get the initial URL (deep link)
        const initialUrl = await Linking.getInitialURL();
        
        if (initialUrl) {
          logger.info('Initial URL detected, checking for attribution data', { feature: 'App', initialUrl });
          
          // Parse attribution parameters
          const attributionData = parseDeepLinkParams(initialUrl);
          
          // Save attribution data to AsyncStorage for later use
          await saveAttributionData(attributionData);
          
          logger.info('Attribution data saved', { 
            feature: 'App',
            hasFbclid: !!attributionData.fbclid,
            hasFbc: !!attributionData.fbc,
            hasUtm: !!attributionData.utm_source
          });
          
          // Check if App Install event was already sent
          const isInstallEventSent = await isAppInstallEventSent();
          
          // Check if we have Facebook attribution data
          // If yes, send App Install event immediately (Scenario A)
          if (!isInstallEventSent && hasFacebookAttribution(attributionData)) {
            logger.info('Facebook attribution detected, sending App Install event', {
              feature: 'App',
              hasFbclid: !!attributionData.fbclid,
              hasFbc: !!attributionData.fbc,
              hasUtm: !!attributionData.utm_source,
              hasEmail: !!attributionData.email,
              hasAppUserId: !!attributionData.appUserId
            });
            
            try {
              // Send App Install event with userId from deep link (if available)
              // Web-funnel users: will have appUserId from deep link (external_id for best EMQ)
              // Direct mobile users: no appUserId yet (will be sent after login in Scenario B)
              await sendAppInstallEventDual(
                attributionData.appUserId || undefined, // userId from web-funnel deep link (if available)
                attributionData,
                attributionData.email ? { email: attributionData.email } : undefined
              );
              
              logger.info('App Install event sent successfully', { 
                feature: 'App',
                hadUserId: !!attributionData.appUserId
              });
              
              // Mark as sent to prevent duplicate sends after login (non-critical)
              try {
                await markAppInstallEventSent();
              } catch (markError) {
                logger.error('Failed to mark app install event as sent (non-critical)', {
                  feature: 'App',
                  error: markError
                });
                // Don't throw - this shouldn't block app initialization
              }
            } catch (error) {
              logger.error('Failed to send App Install event', { feature: 'App', error });
              // Don't block app initialization on tracking error
            }
          } else if (isInstallEventSent) {
            logger.info('App Install event already sent, skipping', {
              feature: 'App',
              hasFacebookAttribution: hasFacebookAttribution(attributionData)
            });
          } else {
            logger.info('No Facebook attribution detected, App Install event will be sent after first login', {
              feature: 'App'
            });
            // NOTE: For organic installs (no deep link or no Facebook attribution),
            // App Install event will be sent after first login:
            // - Android: in auth.service.ts → handlePostLoginTracking
            // - iOS: in tracking-onboarding.tsx (after ATT prompt)
          }
        } else {
          // No deep link at all (organic install from App Store)
          // App Install event will be sent after first login (same as above)
          logger.info('No deep link detected (organic install), App Install event will be sent after first login', {
            feature: 'App'
          });
        }
      } catch (initError) {
        logger.error('Failed to initialize app', { feature: 'App', error: initError instanceof Error ? initError : new Error(String(initError)) });
      } finally {
        // Hide splash screen after all initialization is complete
        // This ensures user sees the UI only after updates are checked and SDKs are initialized
        await SplashScreen.hideAsync();
        logger.info('App initialization complete, splash screen hidden', { feature: 'App' });
      }
    };

    if (loaded) {
      initializeApp();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <SessionProvider>
          <AuthProvider>
            <TrackingOnboardingProvider>
              <NotificationOnboardingProvider>
                <RootLayoutNav />
              </NotificationOnboardingProvider>
            </TrackingOnboardingProvider>
          </AuthProvider>
        </SessionProvider>
      </KeyboardProvider>
      <Toast />
    </SafeAreaProvider>
  );
}

function RootLayoutNav(): React.JSX.Element {
  const { authState, user } = useAuth();
  const { shouldShowOnboarding: shouldShowTrackingOnboarding } = useTrackingOnboarding();
  const segments = useSegments();
  const router = useRouter();
  const hasCheckedAttribution = useRef<boolean>(false);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  // Setup all notification handlers (FCM, navigation, badges)
  useNotificationHandlers(segments, authState, setRedirectPath);

  // Set or clear user context in Sentry when auth state changes
  useEffect(() => {
    if (authState === 'authenticated' && user) {
      logger.setUserContext(user.id);
    } else if (authState === 'unauthenticated') {
      logger.clearUserContext();
    }
  }, [authState, user]);

  // Register FCM token on app start if permission is granted
  useEffect(() => {
    if (!user) return;

    const registerToken = async (): Promise<(() => void) | null> => {
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
  }, [user?.id]);

  // Global heartbeat to update lastActivityAt for notification orchestrator
  // This tracks user activity across ALL screens, not just chat
  // Used by notification orchestrator to determine if user is active (last 6 days)
  useEffect(() => {
    if (!user) return;

    logger.debug('Starting global activity heartbeat', { feature: 'RootLayout', userId: user.id });

    // Update immediately on app start
    updateUserPresence(user.id, null); // null = don't change currentScreen

    // Setup heartbeat to keep activity timestamp fresh (every 5 minutes)
    const heartbeatInterval = setInterval(() => {
      updateUserPresence(user.id, null);
      logger.debug('Activity heartbeat updated', { feature: 'RootLayout', userId: user.id });
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      logger.debug('Stopping global activity heartbeat', { feature: 'RootLayout', userId: user.id });
      clearInterval(heartbeatInterval);
    };
  }, [user?.id]);

  // Check for attribution email (only once when unauthenticated and not showing tracking onboarding)
  useEffect(() => {
    if (authState === 'unauthenticated' && !hasCheckedAttribution.current && !shouldShowTrackingOnboarding) {
      const checkAttributionEmail = async (): Promise<void> => {
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
      router.replace(targetPath);
    }
  }, [authState, segments, shouldShowTrackingOnboarding, redirectPath]);

  if (authState === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: AppColors.background }} testID="auth-loading-container">
        <AnimatedLogo />
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
