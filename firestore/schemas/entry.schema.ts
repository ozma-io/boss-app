/**
 * Timeline Entry Schemas
 * 
 * Path: /users/{userId}/entries/{entryId}
 * 
 * Timeline entries are text-based events with subtypes:
 * - note: General observations
 * - interaction: Meeting/call/communication logs
 * - feedback: Feedback from boss
 * - achievement: Successes and milestones
 * - challenge: Problems and conflicts
 * - other: Anything else
 */

/**
 * Note subtypes for different kinds of text-based entries
 */
export type NoteSubtype = 'note' | 'interaction' | 'feedback' | 'achievement' | 'challenge' | 'other';

/**
 * Base fields common to all entry types
 */
interface BaseEntrySchema {
  type: 'note';
  timestamp: string; // ISO 8601 timestamp
  title: string;
  content: string;
  icon?: string;
  source?: 'onboarding_funnel' | 'user_added' | 'ai_added';
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Note Entry - Text-based timeline entry with subtypes
 * 
 * Represents any text-based event in the timeline.
 * Subtype indicates the specific kind of note.
 */
export interface NoteEntrySchema extends BaseEntrySchema {
  type: 'note';
  subtype: NoteSubtype;
}

/**
 * Entry schema type
 */
export type EntrySchema = NoteEntrySchema;

/**
 * Version tracking
 * Increment this when making breaking schema changes
 * 
 * Version 2: Added FactEntrySchema for tracking single assessments
 *            Simplified SurveyEntrySchema (flat responses array)
 * Version 3: Removed SurveyEntrySchema and InteractionEntrySchema
 *            Added subtype field to NoteEntrySchema
 *            Added icon field to all entry types
 *            Removed 'weekly_survey' from source options
 * Version 4: Removed FactEntrySchema completely
 *            All timeline entries now use type 'note' with subtypes
 */
export const ENTRY_SCHEMA_VERSION = 4;

