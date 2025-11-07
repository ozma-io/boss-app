/**
 * Timeline Entry Schemas
 * 
 * Path: /users/{userId}/bosses/{bossId}/entries/{entryId}
 * 
 * Entries represent different types of timeline events:
 * - notes: Free-form text notes
 * - surveys: Structured questionnaires
 * - interactions: Meeting/communication logs
 */

/**
 * Base fields common to all entry types
 */
interface BaseEntrySchema {
  type: 'note' | 'survey' | 'interaction';
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
 * Discriminated union of all entry types
 */
export type EntrySchema = NoteEntrySchema | SurveyEntrySchema | InteractionEntrySchema;

/**
 * Version tracking
 */
export const ENTRY_SCHEMA_VERSION = 1;

