/**
 * Boss Document Schema
 * 
 * Path: /users/{userId}/bosses/{bossId}
 * 
 * Represents a boss/manager that the user wants to track.
 */

export interface BossSchema {
  // Core information
  name: string;
  position: string;
  department: string;
  startedAt: string; // ISO 8601 timestamp - when user started working with this boss
  
  // Optional profile details
  birthday?: string; // ISO 8601 date string
  managementStyle?: string;
  currentMood?: string;
  favoriteColor?: string;
  communicationPreference?: string;
  meetingFrequency?: string;
  workingHours?: string;
  keyInterests?: string[];
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Default values for optional fields
 */
export const BossDefaults: Partial<BossSchema> = {
  keyInterests: [],
  managementStyle: '',
  currentMood: 'neutral',
  communicationPreference: 'email',
  meetingFrequency: 'weekly',
};

/**
 * Version tracking
 */
export const BOSS_SCHEMA_VERSION = 1;

