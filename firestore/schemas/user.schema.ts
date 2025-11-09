/**
 * User Document Schema
 * 
 * Path: /users/{userId}
 * 
 * This represents the root user document containing profile and settings.
 */

export interface UserSchema {
  email: string;
  createdAt: string; // ISO 8601 timestamp
  
  // Notification settings
  notificationPermissionStatus?: 'granted' | 'denied' | 'not_asked';
  lastNotificationPromptAt?: string | null;
  notificationPromptHistory?: Array<{
    timestamp: string;
    action: 'shown' | 'granted' | 'denied';
  }>;
  
  // App Tracking Transparency (ATT) settings
  trackingPermissionStatus?: 'authorized' | 'denied' | 'not_determined' | 'restricted';
  lastTrackingPromptAt?: string | null;
  trackingPromptHistory?: Array<{
    timestamp: string;
    action: 'shown' | 'authorized' | 'denied';
  }>;
  trackingPromptCount?: number;
  
  // Push notification token for FCM
  fcmToken?: string | null;
  
  // Profile information (optional)
  displayName?: string;
  photoURL?: string;
  
  // Attribution data from Facebook/Meta ads
  attribution?: {
    fbclid?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
    email?: string | null;
    appUserId?: string | null;
    installedAt?: string; // ISO 8601 timestamp
  };
  
  // Metadata
  updatedAt?: string;
}

/**
 * Default values for optional fields
 */
export const UserDefaults: Partial<UserSchema> = {
  notificationPermissionStatus: 'not_asked',
  lastNotificationPromptAt: null,
  notificationPromptHistory: [],
  trackingPermissionStatus: 'not_determined',
  lastTrackingPromptAt: null,
  trackingPromptHistory: [],
  trackingPromptCount: 0,
  fcmToken: null,
  attribution: undefined,
};

/**
 * Version tracking
 * Increment this when making breaking schema changes
 */
export const USER_SCHEMA_VERSION = 2;

