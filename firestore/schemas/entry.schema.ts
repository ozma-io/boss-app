/**
 * Timeline Entry Schemas
 * 
 * Path: /users/{userId}/bosses/{bossId}/entries/{entryId}
 * 
 * Entries represent different types of timeline events:
 * - note: Free-form text notes
 * - survey: Structured questionnaires (simplified flat structure)
 * - interaction: Meeting/communication logs
 * - fact: Single data point/assessment (NEW - for frequently changing states)
 * 
 * ## Fact Entry Pattern:
 * 
 * FactEntry is used for recording single assessments or states that change over time:
 * - Each fact is a separate document in the timeline
 * - Examples: stress level, confidence level, workload assessment
 * - Allows tracking changes over time
 * - Source indicates where the fact was recorded (funnel, user, survey)
 */

/**
 * Base fields common to all entry types
 */
interface BaseEntrySchema {
  type: 'note' | 'survey' | 'interaction' | 'fact';
  timestamp: string; // ISO 8601 timestamp
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Note Entry - Free-form text note
 */
export interface NoteEntrySchema extends BaseEntrySchema {
  type: 'note';
  content: string;
  title?: string;
  tags?: string[];
}

/**
 * Survey Entry - Structured questionnaire response
 * 
 * Simplified structure with flat array of responses.
 * No nested objects for better simplicity.
 */
export interface SurveyEntrySchema extends BaseEntrySchema {
  type: 'survey';
  surveyTitle: string;
  responses: Array<{
    question: string;
    answer: string | number;
  }>;
  notes?: string;
}

/**
 * Interaction Entry - Meeting or communication log
 */
export interface InteractionEntrySchema extends BaseEntrySchema {
  type: 'interaction';
  interactionType: string; // 'meeting', 'email', 'slack', 'call', etc.
  mood: string; // 'positive', 'neutral', 'negative'
  notes: string;
  duration?: number; // in minutes
  participants?: string[];
  topics?: string[];
}

/**
 * Fact Entry - Single data point or assessment
 * 
 * Used for tracking changing states and assessments over time.
 * Each fact is stored as a separate timeline entry.
 * 
 * Examples from web funnel:
 * - custom_confidenceLevel: "Often doubt myself"
 * - custom_stressLevel: "Quite stressful"
 * - custom_workload: "Sometimes overloaded"
 * - custom_teamSupport: "Rather yes"
 */
export interface FactEntrySchema extends BaseEntrySchema {
  type: 'fact';
  factKey: string; // e.g., "custom_confidenceLevel", "custom_stressLevel"
  factLabel: string; // e.g., "Confidence Level", "Stress Level"
  value: string | number | string[]; // The actual value
  category?: string; // e.g., "Emotions", "Workload", "Team"
  source?: 'onboarding_funnel' | 'user_added' | 'weekly_survey';
}

/**
 * Discriminated union of all entry types
 */
export type EntrySchema = NoteEntrySchema | SurveyEntrySchema | InteractionEntrySchema | FactEntrySchema;

/**
 * Version tracking
 * Increment this when making breaking schema changes
 * 
 * Version 2: Added FactEntrySchema for tracking single assessments
 *            Simplified SurveyEntrySchema (flat responses array)
 */
export const ENTRY_SCHEMA_VERSION = 2;

