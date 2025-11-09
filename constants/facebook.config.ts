/**
 * Facebook SDK Configuration
 * 
 * Public constants are hardcoded here.
 * Secrets (APP_SECRET, ACCESS_TOKEN) must be set in environment variables.
 */

// Secrets from environment variables (server-side only)
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN || '';

// ============================================================================
// ⚠️ DUPLICATED in app.config.ts - keep both in sync!
// ============================================================================
export const FACEBOOK_APP_ID = '1234567890'; // TODO: Replace with your actual Facebook App ID
export const FACEBOOK_CLIENT_TOKEN = 'your_client_token_here'; // TODO: Replace with your actual Client Token
export const FACEBOOK_APP_NAME = 'YourFacebookAppName'; // TODO: Replace with your Facebook App Display Name
// ============================================================================
// End of duplicated section
// ============================================================================

// These are auto-imported by functions/src/constants.ts - single source of truth
export const FACEBOOK_PIXEL_ID = '1234567890'; // TODO: Replace with your actual Facebook Pixel ID
export const FACEBOOK_API_VERSION = 'v24.0';

// Client-side SDK configuration
export const FACEBOOK_CONFIG = {
  // Facebook App ID (hardcoded, not a secret)
  appId: FACEBOOK_APP_ID,
  
  // App Display Name
  appName: FACEBOOK_APP_NAME,
  
  // Pixel ID (hardcoded, not a secret)
  pixelId: FACEBOOK_PIXEL_ID,
  
  // Enable automatic event logging (AppInstall, AppLaunch, etc.)
  autoLogAppEvents: true,
  
  // Enable advertiser tracking (for iOS 14.5+)
  advertiserIDCollectionEnabled: true,
};

// Server-side configuration (for Cloud Functions)
export const FACEBOOK_SERVER_CONFIG = {
  // Secrets from env
  appSecret: FACEBOOK_APP_SECRET,
  accessToken: FACEBOOK_ACCESS_TOKEN,
  
  // Public constants
  pixelId: FACEBOOK_PIXEL_ID,
  apiVersion: FACEBOOK_API_VERSION,
  graphApiUrl: 'https://graph.facebook.com',
};

