// Boss type definition synced with BossSchema
export interface Boss {
  id: string;
  
  // Core fields (required)
  name: string;
  position: string;
  department: string;
  startedAt: string;
  createdAt: string;
  updatedAt: string;
  
  // Optional core fields
  birthday?: string;
  workingHours?: string;
  
  // Legacy fields (deprecated, kept for compatibility)
  managementStyle?: string;
  currentMood?: string;
  favoriteColor?: string;
  communicationPreference?: string;
  meetingFrequency?: string;
  keyInterests?: string[];
  
  // Field metadata for custom fields
  _fieldsMeta?: {
    [fieldKey: string]: {
      label: string;
      type: 'text' | 'select' | 'date' | 'multiline' | 'multiselect';
      category?: string;
      source?: 'onboarding_funnel' | 'user_added';
      createdAt: string;
      options?: string[];
    };
  };
  
  // Allow custom fields
  [key: string]: any;
}

// Timeline entry types
export type TimelineEntryType = 'note' | 'survey' | 'interaction' | 'fact';

// Base entry interface
interface BaseEntry {
  id: string;
  timestamp: string;
}

// Note entry
export interface NoteEntry extends BaseEntry {
  type: 'note';
  content: string;
  title?: string;
  tags?: string[];
}

// Survey entry
export interface SurveyEntry extends BaseEntry {
  type: 'survey';
  surveyTitle: string;
  responses: {
    question: string;
    answer: string | number;
  }[];
  notes?: string;
}

// Interaction entry
export interface InteractionEntry extends BaseEntry {
  type: 'interaction';
  interactionType: string;
  mood: string;
  notes: string;
  duration?: number;
  participants?: string[];
  topics?: string[];
}

// Fact entry - for tracking single assessments over time
export interface FactEntry extends BaseEntry {
  type: 'fact';
  factKey: string;
  factLabel: string;
  value: string | number | string[];
  category?: string;
  source?: 'onboarding_funnel' | 'user_added' | 'weekly_survey';
}

// Discriminated union for all timeline entries
export type TimelineEntry = NoteEntry | SurveyEntry | InteractionEntry | FactEntry;

// User type definition (for authentication)
export interface User {
  id: string;
  email: string;
  createdAt: string;
}

// User Profile type definition (for Firestore data)
export interface UserProfile {
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
  updatedAt?: string;
  
  // Subscription data
  subscription?: UserSubscription;
  
  // Custom fields for profile data
  custom_position?: string;
  custom_department?: string;
  custom_goal?: string;
  
  // Field metadata for custom fields
  _fieldsMeta?: {
    [fieldKey: string]: {
      label: string;
      type: 'text' | 'select' | 'date' | 'multiline';
      category?: string;
      source?: string;
      createdAt: string;
      options?: string[];
    };
  };
  
  // Allow custom fields
  [key: string]: any;
}

// Auth state type
export type AuthState = 'authenticated' | 'unauthenticated' | 'loading';

// Unsubscribe function type for Firestore subscriptions
export type Unsubscribe = () => void;

// Notification permission types
export type NotificationPermissionStatus = 'granted' | 'denied' | 'not_asked';

export interface NotificationPromptHistoryItem {
  timestamp: string;
  action: 'shown' | 'granted' | 'denied';
}

export interface UserNotificationData {
  notificationPermissionStatus: NotificationPermissionStatus;
  lastNotificationPromptAt: string | null;
  notificationPromptHistory: NotificationPromptHistoryItem[];
}

// Retry options for network operations
export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  shouldRetry: (error: Error) => boolean;
}

// User Goal
export interface UserGoal {
  id: string;
  title: string;
  description: string;
}

// User Metrics
export interface UserMetrics {
  stressLevel: number;
  bossRelationshipChallenges: number;
  selfDoubtConfidenceGap: number;
}

// Chat Message
export interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  text: string;
  timestamp: string;
}

// Subscription types (aligned with UserSchema)
export type SubscriptionStatus = 'none' | 'active' | 'trial' | 'cancelled' | 'expired' | 'grace_period';
export type SubscriptionTier = 'basic' | 'pro' | 'ultra' | 'enterprise';
export type SubscriptionBillingPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'lifetime';
export type SubscriptionProvider = 'none' | 'stripe' | 'apple' | 'google';

// User subscription data (stored in Firestore)
export interface UserSubscription {
  status: SubscriptionStatus;
  tier?: SubscriptionTier;
  billingPeriod?: SubscriptionBillingPeriod;
  provider: SubscriptionProvider;
  
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEnd?: string;
  cancelledAt?: string;
  
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  
  appleOriginalTransactionId?: string;
  appleTransactionId?: string;
  appleProductId?: string;
  appleReceiptData?: string;
  appleEnvironment?: 'Sandbox' | 'Production';
  
  googlePlayPurchaseToken?: string;
  googlePlayProductId?: string;
  
  createdAt?: string;
  updatedAt?: string;
  lastVerifiedAt?: string;
  
  priceAmount?: number;
  priceCurrency?: string;
  billingCycleMonths?: number;
  
  migratedFrom?: 'stripe' | 'apple';
  migratedAt?: string;
  
  gracePeriodEnd?: string;
}

// Subscription plan configuration (from Remote Config)
export interface SubscriptionPlanConfig {
  tier: SubscriptionTier;
  billingPeriod: SubscriptionBillingPeriod;
  priceAmount: number;
  priceCurrency: string;
  billingCycleMonths: number;
  appleProductId: string;
  googlePlayProductId: string;
  stripeProductId?: string;
  enabled: boolean;
  trial?: {
    days: number;
  };
  savings?: number;
}

