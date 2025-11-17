import { BOSS_REQUIRED_FIELDS, USER_REQUIRED_FIELDS } from '@/firestore/schemas/field-presets';

/**
 * Sanitize a field label to create a valid field key
 * Converts to lowercase, replaces spaces with underscores, removes special characters
 * 
 * @param label - Human-readable field label
 * @returns Sanitized field key (without custom_ prefix)
 */
export function sanitizeFieldKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 50); // Limit length
}

/**
 * Validate that a field key is unique within the document
 * 
 * @param existingFields - Object containing existing fields
 * @param fieldKey - Field key to validate (with custom_ prefix)
 * @returns True if field key is unique, false otherwise
 */
export function validateFieldKey(existingFields: Record<string, any>, fieldKey: string): boolean {
  return existingFields[fieldKey] === undefined;
}

/**
 * Check if a field can be deleted
 * Only custom fields (starting with custom_) that are not required can be deleted
 * 
 * @param documentType - Type of document ('user' or 'boss')
 * @param fieldKey - Field key to check
 * @returns True if field can be deleted, false otherwise
 */
export function canDeleteField(documentType: 'user' | 'boss', fieldKey: string): boolean {
  // Must be a custom field
  if (!fieldKey.startsWith('custom_')) {
    return false;
  }
  
  // Check against required fields
  if (documentType === 'user') {
    return !USER_REQUIRED_FIELDS.includes(fieldKey as any);
  }
  
  if (documentType === 'boss') {
    return !BOSS_REQUIRED_FIELDS.includes(fieldKey as any);
  }
  
  return false;
}

/**
 * Generate a random field key with custom_ prefix
 * Uses 4 random alphanumeric characters (lowercase)
 * Checks for uniqueness and retries if collision occurs
 * 
 * @param existingFields - Object containing existing fields
 * @returns Unique field key with custom_ prefix
 */
export function generateUniqueFieldKey(existingFields: Record<string, any>): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const length = 4;
  const maxAttempts = 10;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let randomId = '';
    for (let i = 0; i < length; i++) {
      randomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const fieldKey = `custom_${randomId}`;
    
    if (validateFieldKey(existingFields, fieldKey)) {
      return fieldKey;
    }
  }
  
  // Fallback: use timestamp if somehow all attempts failed (extremely unlikely)
  return `custom_${Date.now().toString(36)}`;
}

