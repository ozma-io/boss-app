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
  
  // Push notification token for FCM
  fcmToken?: string | null;
  
  // Profile information (optional)
  displayName?: string;
  photoURL?: string;
  
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
  fcmToken: null,
};

/**
 * Version tracking
 * Increment this when making breaking schema changes
 */
export const USER_SCHEMA_VERSION = 1;

