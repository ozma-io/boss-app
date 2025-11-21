import { ExpoConfig } from 'expo/config';

// Facebook constants (must be defined here for Expo config)
// Expo CLI can't import from app code at build time

// ============================================================================
// ⚠️ DUPLICATED in constants/facebook.config.ts - keep both in sync!
// ============================================================================
const FACEBOOK_APP_ID = '853405190716887';
const FACEBOOK_CLIENT_TOKEN = '39f2bc67668285fbd6990e16805565cb';
const FACEBOOK_APP_NAME = 'BossUp';
// ============================================================================
// End of duplicated section
// ============================================================================

// Sentry constants (must be defined here for Expo config)
// Expo CLI can't import from app code at build time

// ============================================================================
// ⚠️ DUPLICATED in constants/sentry.config.ts - keep both in sync!
// ============================================================================
const SENTRY_ORG = 'ozma-inc';
const SENTRY_PROJECT = 'the-boss-app';
// ============================================================================
// End of duplicated section
// ============================================================================

const config: ExpoConfig = {
  name: 'BossUp',
  slug: 'boss-app',
  owner: 'ozma-io',
  version: '1.3.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'bossup',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon-ios.png',
    resizeMode: 'contain',
    backgroundColor: '#FAF8F0',
    ios: {
      image: './assets/images/splash-icon-ios.png',
      resizeMode: 'contain',
      backgroundColor: '#FAF8F0',
    },
    android: {
      image: './assets/images/splash-icon-android.png',
      resizeMode: 'contain',
      backgroundColor: '#FAF8F0',
    },
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.ozmaio.bossup',
    associatedDomains: ['applinks:boss-app.ozma.io', 'applinks:discovery.ozma.io'],
    googleServicesFile: './firebase/GoogleService-Info.plist',
    userInterfaceStyle: 'light',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      FacebookAppID: FACEBOOK_APP_ID,
      FacebookDisplayName: FACEBOOK_APP_NAME,
      LSApplicationQueriesSchemes: ['fbapi', 'fb-messenger-share-api', 'googlechrome', 'googleauth'],
      NSUserTrackingUsageDescription: 'This identifier will be used to deliver personalized ads to you.',
      NSMicrophoneUsageDescription: 'We need access to your microphone to record voice messages in the support chat (Intercom) and to convert your speech to text when you communicate with the assistant.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.ozmaio.bossup',
    googleServicesFile: './firebase/google-services.json',
    userInterfaceStyle: 'light',
    softwareKeyboardLayoutMode: 'pan',
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: [
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.RECEIVE_BOOT_COMPLETED',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'boss-app.ozma.io',
            pathPrefix: '/__/auth',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
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
    'expo-web-browser',
    'expo-system-ui',
    [
      'expo-notifications',
      {
        icon: './assets/images/icon.png',
        color: '#8BC34A',
        sounds: [],
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        organization: SENTRY_ORG,
        project: SENTRY_PROJECT,
      },
    ],
    [
      'react-native-fbsdk-next',
      {
        appID: FACEBOOK_APP_ID,
        clientToken: FACEBOOK_CLIENT_TOKEN,
        displayName: FACEBOOK_APP_NAME,
        scheme: `fb${FACEBOOK_APP_ID}`,
        advertiserIDCollectionEnabled: true,
        autoLogAppEventsEnabled: true,
        // iOS: Manual init after ATT permission (best practice)
        // Android: Auto init early (no ATT permission needed)
        isAutoInitEnabled: false,
        iosUserTrackingPermission: 'This app uses data for delivering personalized ads to you.',
      },
    ],
    [
      '@intercom/intercom-react-native',
      {
        appId: 'xpq2wx7a',
        // These keys are public and safe to commit - they identify the app to Intercom
        // The secret key (INTERCOM_SECRET_KEY) for JWT signing is kept in Firebase Secret Manager
        androidApiKey: 'android_sdk-b92af611f1c5b8a3fffab010503c048b8736c26e',
        iosApiKey: 'ios_sdk-b5e22560fe55000d92cb6eeb3590bef7dae364ed',
      },
    ],
    '@react-native-firebase/app',
    './plugins/withFirebasePodfile',
    '@react-native-google-signin/google-signin',
    [
      'react-native-iap',
      {
        paymentProvider: 'Play Store',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          buildReactNativeFromSource: true,
        },
        android: {
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    // Must be last to modify manifest after all other plugins have run
    './plugins/withNotificationManifestFix',
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

