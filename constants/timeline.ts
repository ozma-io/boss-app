import { NoteSubtype } from '@/types';

/**
 * Default icon mapping for timeline entry types and subtypes
 */
export const DEFAULT_TIMELINE_ICONS: Record<NoteSubtype | 'fact', string> = {
  note: '📝',
  interaction: '💬',
  feedback: '💭',
  achievement: '🏆',
  challenge: '⚠️',
  other: '📌',
  fact: '📊',
};

