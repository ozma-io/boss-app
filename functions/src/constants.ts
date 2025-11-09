/**
 * Facebook Configuration Constants for Cloud Functions
 * 
 * Re-exports from the main config to avoid duplication.
 * This ensures version and Pixel ID are always in sync.
 */

import { FACEBOOK_API_VERSION, FACEBOOK_PIXEL_ID } from '../../constants/facebook.config';

// Re-export for use in Cloud Functions
export { FACEBOOK_API_VERSION, FACEBOOK_PIXEL_ID };

