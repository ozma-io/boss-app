import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface FieldMetadata {
  label: string;
  type: 'text' | 'select' | 'date' | 'multiline' | 'multiselect';
  category?: string;
  source?: string;
  createdAt: string;
  displayOrder?: number;
  options?: string[];
}

interface CustomFieldRowProps {
  fieldKey: string;
  fieldValue: any;
  metadata: FieldMetadata;
  onUpdate: (fieldKey: string, value: any) => Promise<void>;
  variant?: 'boss' | 'profile';
}

/**
 * CustomFieldRow component
 * 
 * Renders a single custom field with inline editing capability.
 * Supports text, select, date, multiline, and multiselect field types.
 * Uses the same styling as boss.tsx infoRow for consistency.
 */
export function CustomFieldRow({
  fieldKey,
  fieldValue,
  metadata,
  onUpdate,
  variant = 'boss',
}: CustomFieldRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');

  const handleEdit = (): void => {
    setValue(String(fieldValue || ''));
    setIsEditing(true);
  };

  const handleBlur = async (): Promise<void> => {
    setIsEditing(false);
    if (value !== fieldValue) {
      await onUpdate(fieldKey, value);
    }
  };

  // Generate testID from fieldKey (remove custom_ prefix for readability)
  const testIdBase = fieldKey.replace('custom_', '');

  // For multiselect, parse JSON array if needed
  const displayValue = metadata.type === 'multiselect' && typeof fieldValue === 'string'
    ? (() => {
        try {
          const parsed = JSON.parse(fieldValue);
          return Array.isArray(parsed) ? parsed.join(', ') : fieldValue;
        } catch {
          return fieldValue;
        }
      })()
    : fieldValue;

  return (
    <Pressable
      style={styles.infoRow}
      testID={`custom-field-${testIdBase}-row`}
      onPress={isEditing ? undefined : handleEdit}
    >
      <Text style={styles.rowIconEmoji} testID={`custom-field-${testIdBase}-icon`}>
        📝
      </Text>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel} testID={`custom-field-${testIdBase}-label`}>
          {metadata.label}
        </Text>
        {isEditing ? (
          <TextInput
            style={[styles.rowValueInput, { outlineStyle: 'none' } as any]}
            value={value}
            onChangeText={setValue}
            onBlur={handleBlur}
            autoFocus
            placeholder={`Enter ${metadata.label.toLowerCase()}`}
            testID={`custom-field-${testIdBase}-input`}
            multiline={metadata.type === 'multiline'}
            numberOfLines={metadata.type === 'multiline' ? 3 : 1}
          />
        ) : (
          <Text
            style={[styles.rowValue, !displayValue && { opacity: 0.5 }]}
            testID={`custom-field-${testIdBase}-value`}
          >
            {displayValue || 'Not set'}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  infoRow: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
  },
  rowIconEmoji: {
    fontSize: 24,
    marginRight: 12,
    width: 32,
    textAlign: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.4)',
    marginBottom: 2,
    fontFamily: 'Manrope-Regular',
  },
  rowValue: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Manrope-Regular',
  },
  rowValueInput: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Manrope-Regular',
    padding: 0,
    margin: 0,
    borderWidth: 0,
  },
});

