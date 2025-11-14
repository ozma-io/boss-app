/**
 * Firestore Schemas
 * 
 * Central export point for all Firestore document schemas.
 * These types define the structure of documents stored in Firestore.
 */

export * from './boss.schema';
export * from './chat.schema';
export * from './entry.schema';
export * from './field-presets';
export * from './user.schema';

/**
 * Schema versions - increment when making breaking changes
 */
export const SCHEMA_VERSIONS = {
  user: 3,
  boss: 2,
  entry: 2,
  chat: 1,
} as const;

