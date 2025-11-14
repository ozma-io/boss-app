/**
 * Sentry Error Monitoring Configuration
 * 
 * Centralized Sentry initialization for Cloud Functions error tracking.
 * Automatically includes version tracking and environment detection.
 */

import * as Sentry from '@sentry/node';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Sentry DSN for boss-app-cloud-functions project
 * This is a public key and safe to commit (similar to FACEBOOK_PIXEL_ID)
 */
const SENTRY_DSN = 'https://c6c5f773287bc359d86a8595b65616d0@o4510351607136256.ingest.us.sentry.io/4510362871726080';

/**
 * Get version from package.json
 */
function getVersion(): string {
  try {
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version || '1.0.0';
  } catch (error) {
    console.error('[Sentry] Failed to read version from package.json:', error);
    return '1.0.0';
  }
}

/**
 * Detect environment based on FUNCTIONS_EMULATOR
 */
function getEnvironment(): string {
  return process.env.FUNCTIONS_EMULATOR === 'true' ? 'development' : 'production';
}

/**
 * Initialize Sentry with proper configuration
 * Should be called once at module load time
 */
export function initSentry(): void {
  const version = getVersion();
  const environment = getEnvironment();
  
  Sentry.init({
    dsn: SENTRY_DSN,
    environment,
    release: `boss-app-cloud-functions@${version}`,
    // Sample 10% of transactions for performance monitoring
    tracesSampleRate: 0.1,
    // Don't send personal data by default
    beforeSend: (event) => {
      // Remove IP address for privacy
      if (event.user) {
        delete event.user.ip_address;
      }
      return event;
    },
  });
  
  console.log(`[Sentry] Initialized for environment: ${environment}, version: ${version}`);
}

// Export Sentry for direct usage in error handlers
export { Sentry };

