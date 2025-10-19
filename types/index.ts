// Boss type definition with all attributes
export interface Boss {
  id: string;
  name: string;
  position: string;
  company: string;
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
}

// Survey entry
export interface SurveyEntry extends BaseEntry {
  type: 'survey';
  surveyTitle: string;
  responses: {
    question: string;
    answer: string | number;
  }[];
}

// Interaction entry
export interface InteractionEntry extends BaseEntry {
  type: 'interaction';
  interactionType: string;
  mood: string;
  notes: string;
  duration?: number;
}

// Discriminated union for all timeline entries
export type TimelineEntry = NoteEntry | SurveyEntry | InteractionEntry;

