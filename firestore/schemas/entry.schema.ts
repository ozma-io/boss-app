/**
 * Timeline Entry Schemas
 * 
 * Path: /users/{userId}/entries/{entryId}
 * 
 * Entries represent different types of timeline events:
 * - note: Text-based entries with subtypes (note, interaction, feedback, achievement, challenge, other)
 * - fact: Single data point/assessment for tracking measurements over time
 * 
 * ## Note Entry Pattern:
 * 
 * NoteEntry is used for all text-based timeline events with different subtypes:
 * - note: General observations
 * - interaction: Meeting/call/communication logs
 * - feedback: Feedback from boss
 * - achievement: Successes and milestones
 * - challenge: Problems and conflicts
 * - other: Anything else
 * 
 * ## Fact Entry Pattern:
 * 
 * FactEntry is used for recording single assessments or states that change over time:
 * - Each fact is a separate document in the timeline
 * - Examples: stress level, confidence level, workload assessment
 * - Allows tracking changes over time
 * - Source indicates where the fact was recorded (funnel, user)
 */

/**
 * Note subtypes for different kinds of text-based entries
 */
export type NoteSubtype = 'note' | 'interaction' | 'feedback' | 'achievement' | 'challenge' | 'other';

/**
 * Base fields common to all entry types
 */
interface BaseEntrySchema {
  type: 'note' | 'fact';
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
 * Fact Entry - Single data point or assessment
 * 
 * Used for tracking changing states and assessments over time.
 * Each fact is stored as a separate timeline entry.
 * 
 * Examples:
 * - title: "Confidence Level", value: "Often doubt myself"
 * - title: "Stress Level", value: "Quite stressful"
 * - title: "Workload", value: "Sometimes overloaded"
 * - title: "Team Support", value: "Rather yes"
 */
export interface FactEntrySchema extends BaseEntrySchema {
  type: 'fact';
  factKey: string; // e.g., "custom_confidenceLevel", "custom_stressLevel"
  value: string | number | string[]; // The actual value
}

/**
 * Discriminated union of all entry types
 */
export type EntrySchema = NoteEntrySchema | FactEntrySchema;

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
 */
export const ENTRY_SCHEMA_VERSION = 3;

