import { ExpoConfig } from 'expo/config';

// Facebook constants (must be defined here for Expo config)
// Expo CLI can't import from app code at build time

// ============================================================================
// ⚠️ DUPLICATED in constants/facebook.config.ts - keep both in sync!
// ============================================================================
const FACEBOOK_APP_ID = '1234567890'; // TODO: Replace with your actual Facebook App ID
const FACEBOOK_CLIENT_TOKEN = 'your_client_token_here'; // TODO: Replace with your actual Client Token
const FACEBOOK_APP_NAME = 'YourFacebookAppName'; // TODO: Replace with your Facebook App Display Name
// ============================================================================
// End of duplicated section
// ============================================================================

const config: ExpoConfig = {
  name: 'The Boss App',
  slug: 'boss-app',
  owner: 'ozma-io',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'bossapp',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.ozmaio.bossapp',
    associatedDomains: ['applinks:discovery.ozma.io'],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      FacebookAppID: FACEBOOK_APP_ID,
      FacebookDisplayName: FACEBOOK_APP_NAME,
      LSApplicationQueriesSchemes: ['fbapi', 'fb-messenger-share-api'],
      NSUserTrackingUsageDescription: 'This identifier will be used to deliver personalized ads to you.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.ozmaio.bossapp',
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'discovery.ozma.io',
            pathPrefix: '/go-app',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-updates',
    'expo-localization',
    [
      'react-native-fbsdk-next',
      {
        appID: FACEBOOK_APP_ID,
        clientToken: FACEBOOK_CLIENT_TOKEN,
        displayName: FACEBOOK_APP_NAME,
        scheme: `fb${FACEBOOK_APP_ID}`,
        advertiserIDCollectionEnabled: true,
        autoLogAppEventsEnabled: true,
        isAutoInitEnabled: true,
        iosUserTrackingPermission: 'This app uses data for delivering personalized ads to you.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  updates: {
    url: 'https://u.expo.dev/747039c7-9e19-4423-92c5-0ee78f36ff36',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  extra: {
    router: {},
    eas: {
      projectId: '747039c7-9e19-4423-92c5-0ee78f36ff36',
    },
  },
};

export default config;

