/**
 * Boss Document Schema
 * 
 * Path: /users/{userId}/bosses/{bossId}
 * 
 * Represents a boss/manager that the user wants to track.
 * 
 * ## Field Categories:
 * 
 * 1. **Core Fields** (cannot be deleted):
 *    - name, position, birthday, managementStyle, startedAt, createdAt, updatedAt (required)
 *    - department, workingHours (optional core)
 * 
 * 2. **Legacy Fields** (deprecated, kept for backward compatibility):
 *    - currentMood, favoriteColor, communicationPreference
 *    - meetingFrequency, keyInterests
 *    - These can be migrated to custom_ fields over time
 * 
 * 3. **Custom Fields** (user-deletable business data):
 *    - All fields with `custom_` prefix
 *    - Metadata stored in `_fieldsMeta`
 *    - Examples: custom_age, custom_oneOnOne, custom_availability
 * 
 * ## Custom Fields Pattern:
 * 
 * Custom fields allow dynamic addition/removal of business data:
 * - Prefix: `custom_` (e.g., `custom_age`, `custom_oneOnOne`)
 * - Metadata: Each custom field must have entry in `_fieldsMeta`
 * - Deletable: All custom fields can be deleted by user
 * - Source tracking: Field metadata includes source (onboarding_funnel, user_added)
 */

export interface BossSchema {
  // === CORE FIELDS (required, cannot be deleted) ===
  
  name: string;
  position: string;
  birthday: string; // ISO 8601 date string
  managementStyle: string;
  startedAt: string; // ISO 8601 timestamp - when user started working with this boss
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
  
  // === OPTIONAL CORE FIELDS ===
  
  department?: string;
  workingHours?: string;
  
  // === LEGACY FIELDS (deprecated, kept for compatibility) ===
  
  currentMood?: string;
  favoriteColor?: string;
  communicationPreference?: string;
  meetingFrequency?: string;
  keyInterests?: string[];
  
  // === CUSTOM FIELDS (user-deletable business data) ===
  
  // Examples of custom fields from web funnel (all optional, all deletable):
  // custom_age?: string;
  // custom_oneOnOne?: string;
  // custom_availability?: string;
  // custom_communicationStyle?: string;
  // custom_askingQuestions?: string;
  // custom_sharingIdeas?: string;
  // custom_receivingFeedback?: string;
  // custom_feedbackClarity?: string;
  // custom_givingFeedback?: string; // JSON string for multi-select
  // custom_recognition?: string;
  // custom_mistakesHandling?: string;
  // custom_clearExpectations?: string;
  // custom_successMetrics?: string;
  // custom_priorityClarity?: string;
  // custom_decisionMaking?: string;
  // custom_feelingValued?: string;
  // ... any other user-defined fields
  
  // Custom fields are strictly typed with custom_ prefix
  [key: `custom_${string}`]: string | string[] | number | boolean | null | undefined;
  
  // === FIELD METADATA ===
  
  /**
   * Metadata for custom fields
   * 
   * Each custom field should have an entry here with:
   * - label: Display name for UI
   * - type: Field type (text, select, date, multiline, multiselect)
   * - category: Optional grouping (Communication, Feedback, Expectations, etc.)
   * - source: Where field was created (onboarding_funnel, user_added)
   * - createdAt: When field was added
   * - options: Available options for select/multiselect type
   */
  _fieldsMeta?: {
    [fieldKey: string]: {
      label: string;
      type: 'text' | 'select' | 'date' | 'multiline' | 'multiselect';
      category?: string;
      source?: 'onboarding_funnel' | 'user_added';
      createdAt: string; // ISO 8601 timestamp
      displayOrder?: number; // For custom ordering of fields
      options?: string[]; // For select/multiselect type
    };
  };
}

/**
 * Default values for optional core and legacy fields
 * 
 * Note: Custom fields do not have defaults here.
 * They are created dynamically with metadata in _fieldsMeta.
 */
export const BossDefaults: Partial<BossSchema> = {
  keyInterests: [],
  managementStyle: '',
  currentMood: 'neutral',
  communicationPreference: 'email',
  meetingFrequency: 'weekly',
  _fieldsMeta: {},
};

/**
 * Version tracking
 * Increment this when making breaking schema changes
 * 
 * Version 2: Added custom fields pattern with _fieldsMeta
 *            Made createdAt and updatedAt required
 * Version 3: Made birthday and managementStyle required core fields
 *            Made department optional
 */
export const BOSS_SCHEMA_VERSION = 3;

