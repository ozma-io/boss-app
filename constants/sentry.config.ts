/**
 * Sentry Configuration
 * 
 * Error tracking and monitoring configuration for BossUp.
 * DSN provided by Sentry setup: https://f1a4dd0c3c892048c31d0f9752af4e0f@o4510351607136256.ingest.us.sentry.io/4510351607922689
 */

/**
 * Sentry DSN (Data Source Name)
 * 
 * DSN is a public key and safe to commit to the repository.
 * It identifies where errors should be sent.
 */
export const SENTRY_DSN = 'https://f1a4dd0c3c892048c31d0f9752af4e0f@o4510351607136256.ingest.us.sentry.io/4510351607922689';

// ============================================================================
// ⚠️ DUPLICATED in app.config.ts - keep both in sync!
// Expo CLI can't import from app code at build time, so these constants
// must be duplicated in app.config.ts for the Sentry plugin configuration
// ============================================================================
export const SENTRY_ORG = 'ozma-inc';
export const SENTRY_PROJECT = 'the-boss-app';
// ============================================================================
// End of duplicated section
// ============================================================================

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
  // Enable by default, can be disabled with env var EXPO_PUBLIC_SENTRY_ENABLED=false
  enabled: process.env.EXPO_PUBLIC_SENTRY_ENABLED !== 'false',
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

