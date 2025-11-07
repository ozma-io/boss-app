// Boss type definition with all attributes
export interface Boss {
  id: string;
  name: string;
  position: string;
  department: string;
  startedAt: string;
  birthday: string;
  managementStyle: string;
  currentMood: string;
  favoriteColor: string;
  communicationPreference: string;
  meetingFrequency: string;
  workingHours: string;
  keyInterests: string[];
}

// Timeline entry types
export type TimelineEntryType = 'note' | 'survey' | 'interaction';

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

// Discriminated union for all timeline entries
export type TimelineEntry = NoteEntry | SurveyEntry | InteractionEntry;

// User type definition
export interface User {
  id: string;
  email: string;
  createdAt: string;
}

// Auth state type
export type AuthState = 'authenticated' | 'unauthenticated' | 'loading';

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

// Subscription Plan
export type SubscriptionPlanType = 'monthly' | 'semi-annual' | 'quarterly';

export interface SubscriptionPlan {
  type: SubscriptionPlanType;
  price: number;
  billingPeriod: string;
  hasTrial?: boolean;
  trialDays?: number;
}

export interface UserSubscription {
  currentPlan: SubscriptionPlanType;
  status: 'active' | 'inactive' | 'cancelled';
  nextPaymentDate: string;
  price: number;
  savings?: number;
}

