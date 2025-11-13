/**
 * Field helpers for custom fields management
 * 
 * Provides utilities for filtering, sorting, and managing custom fields
 * in Boss and UserProfile objects.
 */

interface FieldMetadata {
  label: string;
  type: 'text' | 'select' | 'date' | 'multiline' | 'multiselect';
  category?: string;
  source?: string;
  createdAt: string;
  displayOrder?: number;
  options?: string[];
}

interface CustomField {
  key: string;
  value: any;
  metadata: FieldMetadata;
}

/**
 * Check if a field key is a custom field
 * Custom fields start with 'custom_' prefix
 */
export function isCustomField(key: string): boolean {
  return key.startsWith('custom_');
}

/**
 * Get all custom fields from an object with their metadata
 * Returns sorted array of custom fields
 */
export function getCustomFields(
  obj: Record<string, any>,
  fieldsMeta?: Record<string, FieldMetadata>
): CustomField[] {
  if (!obj) {
    return [];
  }

  const customFields: CustomField[] = [];

  // Extract all custom_ fields
  Object.keys(obj).forEach((key) => {
    if (isCustomField(key)) {
      const metadata = fieldsMeta?.[key];
      if (metadata) {
        customFields.push({
          key,
          value: obj[key],
          metadata,
        });
      }
    }
  });

  // Sort fields by displayOrder, then by createdAt
  return sortFieldsByOrder(customFields);
}

/**
 * Sort fields by displayOrder (if present), then by createdAt
 * Fields with lower displayOrder come first
 * If displayOrder is missing or equal, sort by createdAt (older first)
 */
export function sortFieldsByOrder(fields: CustomField[]): CustomField[] {
  return fields.sort((a, b) => {
    const orderA = a.metadata.displayOrder;
    const orderB = b.metadata.displayOrder;

    // If both have displayOrder, compare them
    if (orderA !== undefined && orderB !== undefined) {
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      // If displayOrder is equal, fall through to createdAt comparison
    }

    // If only one has displayOrder, it comes first
    if (orderA !== undefined && orderB === undefined) {
      return -1;
    }
    if (orderA === undefined && orderB !== undefined) {
      return 1;
    }

    // If neither has displayOrder or they're equal, sort by createdAt
    const dateA = new Date(a.metadata.createdAt).getTime();
    const dateB = new Date(b.metadata.createdAt).getTime();
    return dateA - dateB;
  });
}

