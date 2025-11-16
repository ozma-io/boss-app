/**
 * Facebook SDK Configuration
 * 
 * Public constants are hardcoded here.
 * Secret (ACCESS_TOKEN) must be set in environment variables.
 */

// Secret from environment variables (server-side only)
const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN || '';

// ============================================================================
// ⚠️ DUPLICATED in app.config.ts - keep both in sync!
// ============================================================================
export const FACEBOOK_APP_ID = '853405190716887';
export const FACEBOOK_CLIENT_TOKEN = '39f2bc67668285fbd6990e16805565cb';
export const FACEBOOK_APP_NAME = 'BossUp';
// ============================================================================
// End of duplicated section
// ============================================================================

// ============================================================================
// ⚠️ DUPLICATED in functions/src/constants.ts - keep both in sync!
// ============================================================================
export const FACEBOOK_PIXEL_ID = '1170898585142562';
export const FACEBOOK_API_VERSION = 'v24.0';
// ============================================================================
// End of duplicated section
// ============================================================================

// Client-side SDK configuration
export const FACEBOOK_CONFIG = {
  // Facebook App ID (hardcoded, not a secret)
  appId: FACEBOOK_APP_ID,
  
  // App Display Name
  appName: FACEBOOK_APP_NAME,
  
  // Pixel ID (hardcoded, not a secret)
  pixelId: FACEBOOK_PIXEL_ID,
  
  // Enable automatic event logging (AppInstall, AppLaunch, etc.)
  autoLogAppEvents: false,
  
  // Enable advertiser tracking (for iOS 14.5+)
  advertiserIDCollectionEnabled: true,
};

// Server-side configuration (for Cloud Functions)
export const FACEBOOK_SERVER_CONFIG = {
  // Secret from env
  accessToken: FACEBOOK_ACCESS_TOKEN,
  
  // Public constants
  pixelId: FACEBOOK_PIXEL_ID,
  apiVersion: FACEBOOK_API_VERSION,
  graphApiUrl: 'https://graph.facebook.com',
};

