/**
 * Sentry Configuration
 * 
 * Error tracking and monitoring configuration for the Boss App.
 * DSN provided by Sentry setup: https://f1a4dd0c3c892048c31d0f9752af4e0f@o4510351607136256.ingest.us.sentry.io/4510351607922689
 */

export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || 'https://f1a4dd0c3c892048c31d0f9752af4e0f@o4510351607136256.ingest.us.sentry.io/4510351607922689';

export const SENTRY_ORG = 'ozma-inc';
export const SENTRY_PROJECT = 'react-native';

/**
 * Sentry initialization options
 */
export const getSentryOptions = (isDevelopment: boolean) => ({
  dsn: SENTRY_DSN,
  environment: isDevelopment ? 'development' : 'production',
  // Enable automatic session tracking
  enableAutoSessionTracking: true,
  // Sessions close after app is in background for 30 seconds
  sessionTrackingIntervalMillis: 30000,
  // Only send errors in production by default (can be overridden with env var)
  enabled: process.env.EXPO_PUBLIC_SENTRY_ENABLED === 'true' || !isDevelopment,
  // Enable automatic breadcrumbs for navigation, console, etc
  enableNativeCrashHandling: true,
  // Don't send personal data by default
  beforeSend: (event: any) => {
    // Remove user IP address for privacy
    if (event.user) {
      delete event.user.ip_address;
    }
    return event;
  },
});

