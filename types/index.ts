// === IMPORTS FROM SCHEMAS (Single Source of Truth) ===
import type { 
  UserSchema,
  BossSchema,
  ChatThreadSchema,
  ChatMessageSchema,
  ContentItemSchema,
  MessageRole,
  ContentType,
  NoteEntrySchema,
  NoteSubtype,
  EmailSchema
} from '@/firestore/schemas';

// === DERIVED TYPES ===

// Custom field types
export type CustomFieldValue = 
  | string
  | string[]
  | number
  | boolean
  | null;

export interface CustomFieldMetadata {
  label: string;
  type: 'text' | 'select' | 'date' | 'multiline' | 'multiselect';
  category?: string;
  source?: 'onboarding_funnel' | 'user_added';
  createdAt: string;
  displayOrder?: number;
  options?: string[];
}

// === USER TYPES ===

// Minimal user type for auth state (subset of UserSchema)
export interface User {
  id: string;
  email: string;
  createdAt: string;
  currentScreen: string | null;
  lastActivityAt: string | null;
}

// Full user profile type (alias to UserSchema)
export type UserProfile = UserSchema;

// Update type (keep 'any' for Firestore flexibility)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UserProfileUpdate = Record<string, any>;

// === BOSS TYPES ===

// Boss type (alias to BossSchema with id)
export interface Boss extends BossSchema {
  id: string;
}

// Update type (keep 'any' for Firestore flexibility)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BossUpdate = Record<string, any>;

// === CHAT TYPES ===

export type { MessageRole, ContentType };

export interface ContentItem extends ContentItemSchema {}

export interface ChatMessage extends ChatMessageSchema {}

export interface ChatThread extends ChatThreadSchema {}

// === TIMELINE TYPES ===

export type TimelineEntryType = 'note';

export type { NoteSubtype };

export interface NoteEntry extends NoteEntrySchema {
  id: string;
}

export type TimelineEntry = NoteEntry;

// === EMAIL TYPES ===

export type EmailState = 'PLANNED' | 'SENDING' | 'SENT' | 'FAILED';

export interface Email extends EmailSchema {}

// === SUBSCRIPTION TYPES ===

// Extract from UserSchema.subscription
export type SubscriptionStatus = 'none' | 'active' | 'trial' | 'cancelled' | 'expired' | 'grace_period';
export type SubscriptionTier = 'basic' | 'pro' | 'ultra' | 'enterprise';
export type SubscriptionBillingPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'lifetime';
export type SubscriptionProvider = 'none' | 'stripe' | 'apple' | 'google';

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

// === AUTH TYPES ===

// Auth state type
export type AuthState = 'authenticated' | 'unauthenticated' | 'loading';

// Unsubscribe function type for Firestore subscriptions
export type Unsubscribe = () => void;

// === NOTIFICATION TYPES ===

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

// === RETRY TYPES ===

// Retry options for network operations
export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  shouldRetry: (error: Error) => boolean;
}

// === CHAT REQUEST TYPES ===

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

// === ACCOUNT DELETION TYPES ===

// Account deletion types
export interface DeleteAccountRequest {
  confirmationText: string; // Must be "DELETE MY ACCOUNT"
}

export interface DeleteAccountResponse {
  success: boolean;
  error?: string;
}

// Account anonymization types
export interface AnonymizeAccountRequest {
  confirmationText: string; // Must be "DELETE MY ACCOUNT"
}

export interface AnonymizeAccountResponse {
  success: boolean;
  error?: string;
  anonymousEmail?: string;
}
