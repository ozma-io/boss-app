// Type for custom field values based on field type
export type CustomFieldValue = 
  | string        // text, multiline, date, select
  | string[]      // multiselect
  | number        // potential numeric fields
  | boolean       // potential checkbox fields
  | null;         // deleted field

// Type for field metadata
export interface CustomFieldMetadata {
  label: string;
  type: 'text' | 'select' | 'date' | 'multiline' | 'multiselect';
  category?: string;
  source?: 'onboarding_funnel' | 'user_added';
  createdAt: string;
  displayOrder?: number;
  options?: string[];
}

// Boss base interface with known fields only
interface BossBase {
  id: string;
  
  // Core fields (required)
  name: string;
  position: string;
  birthday: string;
  managementStyle: string;
  startedAt: string;
  createdAt: string;
  updatedAt: string;
  
  // Optional core fields
  department?: string;
  workingHours?: string;
  
  // Legacy fields (deprecated, kept for compatibility)
  currentMood?: string;
  favoriteColor?: string;
  communicationPreference?: string;
  meetingFrequency?: string;
  keyInterests?: string[];
  
  // Field metadata for custom fields
  _fieldsMeta?: {
    [fieldKey: string]: CustomFieldMetadata;
  };
}

// Boss type definition synced with BossSchema
export interface Boss extends BossBase {
  // Allow ONLY custom_ prefixed fields with typed values
  [key: `custom_${string}`]: CustomFieldValue;
}

// Type for Boss updates (allows Firestore dot notation and FieldValue)
// Using Record for updates to support Firestore operations (deleteField, dot notation for nested updates)
export type BossUpdate = Record<string, any>

// Timeline entry types
export type TimelineEntryType = 'note';

// Note subtypes for different kinds of text-based entries
export type NoteSubtype = 'note' | 'interaction' | 'feedback' | 'achievement' | 'challenge' | 'other';

// Base entry interface
interface BaseEntry {
  id: string;
  timestamp: string;
  title: string;
  content: string;
  icon?: string;
  source?: 'onboarding_funnel' | 'user_added' | 'ai_added';
}

// Note entry - text-based timeline entry with subtypes
export interface NoteEntry extends BaseEntry {
  type: 'note';
  subtype: NoteSubtype;
}

// Discriminated union for all timeline entries
export type TimelineEntry = NoteEntry;

// User type definition (for authentication state - minimal data from Firebase Auth)
export interface User {
  id: string;
  email: string;
  createdAt: string;
  currentScreen: string | null; // Current screen user is viewing ('chat', 'support', etc)
  lastActivityAt: string | null; // Last activity timestamp for presence timeout
}

// User Profile base interface with known fields only
interface UserProfileBase {
  email: string;
  name: string;
  goal: string;
  position: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
  updatedAt?: string;
  
  // Subscription data
  subscription?: UserSubscription;
  
  // Notification settings
  email_unsubscribed?: boolean;
  notification_state?: {
    last_notification_at?: string;
  };
  
  // Field metadata for custom fields
  _fieldsMeta?: {
    [fieldKey: string]: CustomFieldMetadata;
  };
}

// User Profile type definition (for Firestore data)
export interface UserProfile extends UserProfileBase {
  // Allow ONLY custom_ prefixed fields with typed values
  [key: `custom_${string}`]: CustomFieldValue;
}

// Type for UserProfile updates (allows Firestore dot notation and FieldValue)
// Using Record for updates to support Firestore operations (deleteField, dot notation for nested updates)
export type UserProfileUpdate = Record<string, any>

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

// Chat types (OpenAI-compatible multimodal format)
export interface ChatThread {
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  assistantIsTyping: boolean;
  currentGenerationId?: string;
  
  // Unread message tracking
  unreadCount: number;
  lastReadAt: string | null;
  lastMessageAt: string | null;
  lastMessageRole: MessageRole | null;
}

export type MessageRole = 'user' | 'assistant' | 'system';
export type ContentType = 'text' | 'image_url';

export interface ContentItem {
  type: ContentType;
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

export interface ChatMessage {
  role: MessageRole;
  content: ContentItem[];
  timestamp: string;
}

// Result type for loading older messages with pagination
export interface LoadMessagesResult {
  messages: ChatMessage[];
  hasMore: boolean;
}

// Request data for generateChatResponse Cloud Function
export interface GenerateChatResponseRequest {
  userId: string;
  threadId: string;
  messageId: string;
  sessionId?: string; // Optional app session ID for LangFuse grouping
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
  cancellationReason?: 'migration' | 'user_request';
  
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  
  appleOriginalTransactionId?: string;
  appleTransactionId?: string;
  appleProductId?: string;
  appleEnvironment?: 'Sandbox' | 'Production';
  appleRevocationDate?: string;
  appleRevocationReason?: number;
  
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

// In-App Purchase types
export interface IAPPurchaseResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface IAPProduct {
  productId: string;
  price: string;
  currency: string;
  title: string;
  description: string;
}

// Response from cancelSubscription Cloud Function
export interface CancelSubscriptionResponse {
  success: boolean;
  currentPeriodEnd?: string;
  error?: string;
}

// Account deletion types
export interface DeleteAccountRequest {
  confirmationText: string; // Must be "DELETE MY ACCOUNT"
}

export interface DeleteAccountResponse {
  success: boolean;
  error?: string;
}

// Email notification types
export type EmailState = 'PLANNED' | 'SENDING' | 'SENT' | 'FAILED';

export interface Email {
  to: string;
  subject: string;
  body_text: string;
  state: EmailState;
  sentAt?: string;
  lastErrorMessage?: string;
  createdAt: string;
}

