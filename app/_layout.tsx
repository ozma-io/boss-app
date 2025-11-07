import { AppColors } from '@/constants/Colors';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
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

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const { authState } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authState === 'loading') {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (authState === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (authState === 'authenticated' && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [authState, segments]);

  if (authState === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: AppColors.background }}>
        <ActivityIndicator size="large" color={AppColors.loaderColor} />
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
          name="(tabs)" 
          options={{ 
            headerShown: false,
            title: '',
          }} 
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="boss-details" options={{ headerShown: true, title: 'Boss Details' }} />
        <Stack.Screen name="entry-details" options={{ headerShown: true, title: 'Entry Details' }} />
      </Stack>
    </ThemeProvider>
  );
}
