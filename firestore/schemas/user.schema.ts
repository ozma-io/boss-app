/**
 * User Document Schema
 * 
 * Path: /users/{userId}
 * 
 * This represents the root user document containing profile and settings.
 * 
 * ## Field Categories:
 * 
 * 1. **Core Fields** (cannot be deleted):
 *    - email, createdAt (required)
 *    - displayName, photoURL, updatedAt (optional core)
 * 
 * 2. **Technical Fields** (system-managed):
 *    - fcmToken, notification permissions, tracking permissions
 * 
 * 3. **Attribution & Subscription** (system-managed):
 *    - attribution object, subscription object
 * 
 * 4. **Custom Fields** (user-deletable business data):
 *    - All fields with `custom_` prefix
 *    - Metadata stored in `_fieldsMeta`
 *    - Examples: custom_age, custom_goal, custom_position
 * 
 * ## Custom Fields Pattern:
 * 
 * Custom fields allow dynamic addition/removal of business data:
 * - Prefix: `custom_` (e.g., `custom_age`, `custom_goal`)
 * - Metadata: Each custom field must have entry in `_fieldsMeta`
 * - Deletable: All custom fields can be deleted by user
 * - Source tracking: Field metadata includes source (onboarding_funnel, user_added, etc.)
 */

export interface UserSchema {
  // === CORE FIELDS (cannot be deleted) ===
  
  // Identity (required)
  email: string;
  createdAt: string; // ISO 8601 timestamp
  
  // Profile (optional core)
  updatedAt?: string;
  displayName?: string;
  photoURL?: string;
  
  // === TECHNICAL FIELDS (system-managed) ===
  
  // Push notification token for FCM
  fcmToken?: string | null;
  
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
  
  // === ATTRIBUTION DATA (system-managed) ===
  
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
  
  // === SUBSCRIPTION DATA (system-managed) ===
  
  subscription?: {
    status?: 'active' | 'cancelled' | 'expired' | 'trial';
    plan?: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
    currentPeriodEnd?: string; // ISO 8601 timestamp
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  };
  
  // === CUSTOM FIELDS (user-deletable business data) ===
  
  // Examples of custom fields (all optional, all deletable):
  // custom_age?: string;
  // custom_position?: string;
  // custom_department?: string;
  // custom_whenStartedJob?: string;
  // custom_goal?: string;
  // custom_skillsMatch?: string;
  // custom_careerDiscussion?: string;
  // custom_growthOpportunities?: string;
  // custom_learningSupport?: string;
  // ... any other user-defined or funnel-created fields
  
  // Allow any custom field
  [key: string]: any;
  
  // === FIELD METADATA ===
  
  /**
   * Metadata for custom fields
   * 
   * Each custom field should have an entry here with:
   * - label: Display name for UI
   * - type: Field type (text, select, date, multiline)
   * - category: Optional grouping (Demographics, Career, etc.)
   * - source: Where field was created (onboarding_funnel, user_added, weekly_survey)
   * - createdAt: When field was added
   * - options: Available options for select type
   */
  _fieldsMeta?: {
    [fieldKey: string]: {
      label: string;
      type: 'text' | 'select' | 'date' | 'multiline';
      category?: string;
      source?: 'onboarding_funnel' | 'user_added' | 'weekly_survey';
      createdAt: string; // ISO 8601 timestamp
      options?: string[]; // For select type
    };
  };
}

/**
 * Default values for optional core and technical fields
 * 
 * Note: Custom fields do not have defaults here.
 * They are created dynamically with metadata in _fieldsMeta.
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
  _fieldsMeta: {},
};

/**
 * Version tracking
 * Increment this when making breaking schema changes
 * 
 * Version 3: Added custom fields pattern with _fieldsMeta
 */
export const USER_SCHEMA_VERSION = 3;

