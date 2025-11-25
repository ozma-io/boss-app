/**
 * Firestore Schemas
 * 
 * Central export point for all Firestore document schemas.
 * These types define the structure of documents stored in Firestore.
 * 
 * === SINGLE SOURCE OF TRUTH ===
 * All schemas are exported from here and should be used throughout the app.
 * App types (types/index.ts) derive from these schemas.
 */

// === TYPE EXPORTS (Single Source of Truth) ===

// User types
export type { UserSchema } from './user.schema';
export type { UserDefaults } from './user.schema';

// Boss types
export type { BossSchema } from './boss.schema';
export type { BossDefaults } from './boss.schema';

// Chat types
export type { ChatThreadSchema, ChatMessageSchema, ContentItemSchema, MessageRole, ContentType } from './chat.schema';

// Entry types
export type { NoteEntrySchema, EntrySchema, NoteSubtype } from './entry.schema';

// Email types
export type { EmailSchema } from './email.schema';

// Field presets
export type { FieldPreset } from './field-presets';
export { 
  USER_REQUIRED_FIELDS, 
  BOSS_REQUIRED_FIELDS,
  USER_FUNNEL_FIELD_PRESETS,
  BOSS_FUNNEL_FIELD_PRESETS,
  getUserCustomFieldKeys,
  getBossCustomFieldKeys,
  isUserFieldRequired,
  isBossFieldRequired
} from './field-presets';

// === LEGACY EXPORTS (for backwards compatibility) ===
export * from './boss.schema';
export * from './chat.schema';
export * from './email.schema';
export * from './entry.schema';
export * from './user.schema';

/**
 * Schema versions - increment when making breaking changes
 */
export const SCHEMA_VERSIONS = {
  user: 3,
  boss: 2,
  entry: 4,
  chat: 1,
  email: 1,
} as const;

