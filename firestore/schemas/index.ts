/**
 * Firestore Schemas
 * 
 * Central export point for all Firestore document schemas.
 * These types define the structure of documents stored in Firestore.
 */

export * from './user.schema';
export * from './boss.schema';
export * from './entry.schema';

/**
 * Schema versions - increment when making breaking changes
 */
export const SCHEMA_VERSIONS = {
  user: 1,
  boss: 1,
  entry: 1,
} as const;

