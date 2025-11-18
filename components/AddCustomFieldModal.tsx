import { showAlert } from '@/utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Modal from 'react-native-modal';

interface AddCustomFieldModalProps {
  isVisible: boolean;
  onClose: () => void;
  onCreateEmpty?: () => Promise<string>;
  onUpdate?: (fieldKey: string, updates: { label?: string; type?: FieldType; value?: string }) => Promise<void>;
  fieldKeyToEdit?: string;
  initialLabel?: string;
  initialValue?: string;
  initialType?: FieldType;
}

type FieldType = 'text' | 'multiline' | 'select' | 'date' | 'multiselect';

// TODO: Currently only 'text' type is fully implemented and enabled
// TODO: Implement 'multiline' type - support for multiline text input with proper rendering
// TODO: Implement 'select' type - dropdown with custom options, needs options management UI
// TODO: Implement 'date' type - date picker with proper date formatting and storage
const FIELD_TYPES: Array<{ value: FieldType; label: string; icon: string; enabled: boolean }> = [
  { value: 'text', label: 'Text', icon: 'text-outline', enabled: true },
  { value: 'multiline', label: 'Multiline Text', icon: 'document-text-outline', enabled: false },
  { value: 'select', label: 'Select', icon: 'list-outline', enabled: false },
  { value: 'date', label: 'Date', icon: 'calendar-outline', enabled: false },
];

/**
 * Modal for adding a new custom field
 * Creates empty field immediately on open, auto-saves all changes
 */
export function AddCustomFieldModal({ isVisible, onClose, onCreateEmpty, onUpdate, fieldKeyToEdit, initialLabel, initialValue: initialValueProp, initialType }: AddCustomFieldModalProps) {
  const [label, setLabel] = useState<string>('');
  const [selectedType, setSelectedType] = useState<FieldType>('text');
  const [value, setValue] = useState<string>('');
  const [currentFieldKey, setCurrentFieldKey] = useState<string | null>(null);

  // Debounce timer refs
  const labelDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Track if fields have been initialized to prevent re-initialization on parent re-renders
  const hasInitializedFieldsRef = useRef<boolean>(false);

  // Create empty field or use existing fieldKey when editing
  useEffect(() => {
    if (!isVisible) {
      // Reset initialization flag when modal closes
      hasInitializedFieldsRef.current = false;
      return;
    }

    // Only initialize once when modal opens
    if (hasInitializedFieldsRef.current) return;
    hasInitializedFieldsRef.current = true;

    if (fieldKeyToEdit) {
      // Edit mode: use existing fieldKey
      setCurrentFieldKey(fieldKeyToEdit);
      setLabel(initialLabel || '');
      setValue(initialValueProp || '');
      setSelectedType(initialType || 'text');
    } else {
      // Create mode: create empty field immediately
      const createEmpty = async (): Promise<void> => {
        if (onCreateEmpty && !currentFieldKey) {
          try {
            const newFieldKey = await onCreateEmpty();
            setCurrentFieldKey(newFieldKey);
          } catch (error) {
            showAlert(
              'Something went wrong',
              'We couldn\'t create this field right now. Our team has been notified and is working on it. Please try again later.'
            );
            onClose();
          }
        }
      };

      // Reset to defaults
      setLabel('');
      setSelectedType('text');
      setValue('');

      createEmpty();
    }
  }, [fieldKeyToEdit, isVisible, onCreateEmpty, onClose]);

  // Reset currentFieldKey when modal closes
  useEffect(() => {
    if (!isVisible) {
      setCurrentFieldKey(null);
    }
  }, [isVisible]);

  const handleClose = (): void => {
    onClose();
  };

  // Auto-save function
  const autoSave = useCallback(async (updates: { label?: string; type?: FieldType; value?: string }): Promise<void> => {
    if (!currentFieldKey || !onUpdate) return;

    try {
      await onUpdate(currentFieldKey, updates);
    } catch (error) {
      // Silent fail - user can retry by changing field again
    }
  }, [currentFieldKey, onUpdate]);

  // Debounced auto-save for label
  useEffect(() => {
    if (!currentFieldKey) return;

    if (labelDebounceTimer.current) {
      clearTimeout(labelDebounceTimer.current);
    }

    labelDebounceTimer.current = setTimeout(() => {
      autoSave({ label });
    }, 500);

    return () => {
      if (labelDebounceTimer.current) {
        clearTimeout(labelDebounceTimer.current);
      }
    };
  }, [label, currentFieldKey, autoSave]);

  // Debounced auto-save for value
  useEffect(() => {
    if (!currentFieldKey) return;

    if (valueDebounceTimer.current) {
      clearTimeout(valueDebounceTimer.current);
    }

    valueDebounceTimer.current = setTimeout(() => {
      autoSave({ value });
    }, 500);

    return () => {
      if (valueDebounceTimer.current) {
        clearTimeout(valueDebounceTimer.current);
      }
    };
  }, [value, currentFieldKey, autoSave]);

  // Immediate auto-save for type
  useEffect(() => {
    if (!currentFieldKey) return;
    autoSave({ type: selectedType });
  }, [selectedType, currentFieldKey, autoSave]);

  const handleTypePress = (type: { value: FieldType; label: string; icon: string; enabled: boolean }): void => {
    if (type.enabled) {
      setSelectedType(type.value);
    } else {
      showAlert(
        'Coming Soon',
        'This field type is not yet implemented but will be available soon.'
      );
    }
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={handleClose}
      onSwipeComplete={handleClose}
      swipeDirection={['down']}
      style={styles.modal}
      propagateSwipe
      avoidKeyboard
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropOpacity={0.35}
    >
      <KeyboardAwareScrollView 
        style={styles.keyboardView} 
        contentContainerStyle={styles.modalContent} 
        showsVerticalScrollIndicator={false} 
        bottomOffset={40}
        testID="add-custom-field-modal"
      >
        <View style={styles.header}>
          <View style={styles.dragHandle} />
          <Text style={styles.title} testID="modal-title">
            Add Custom Field
          </Text>
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            testID="close-button"
          >
            <Ionicons name="close" size={28} color="#000" />
          </Pressable>
        </View>

        <View style={styles.scrollView}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel} testID="label-section-label">
                Field Label
              </Text>
              <TextInput
                style={[styles.input, { outlineStyle: 'none' } as any]}
                value={label}
                onChangeText={setLabel}
                placeholder="e.g., Pet Name, Favorite Color"
                placeholderTextColor="rgba(0, 0, 0, 0.3)"
                testID="field-label-input"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel} testID="type-section-label">
                Field Type
              </Text>
              <View style={styles.typeButtons}>
                {FIELD_TYPES.map((type) => (
                  <Pressable
                    key={type.value}
                    style={[
                      styles.typeButton,
                      selectedType === type.value && styles.typeButtonSelected,
                      !type.enabled && styles.typeButtonDisabled,
                    ]}
                    onPress={() => handleTypePress(type)}
                    testID={`type-option-${type.value}`}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={20}
                      color={selectedType === type.value ? '#B8E986' : '#666'}
                    />
                    <Text
                      style={[
                        styles.typeButtonText,
                        selectedType === type.value && styles.typeButtonTextSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel} testID="value-section-label">
                {fieldKeyToEdit ? 'Value' : 'Initial Value (Optional)'}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  selectedType === 'multiline' && styles.multilineInput,
                  { outlineStyle: 'none' } as any,
                ]}
                value={value}
                onChangeText={setValue}
                placeholder="Enter value..."
                placeholderTextColor="rgba(0, 0, 0, 0.3)"
                multiline={selectedType === 'multiline'}
                numberOfLines={selectedType === 'multiline' ? 3 : 1}
                testID="initial-value-input"
              />
            </View>
        </View>
      </KeyboardAwareScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  keyboardView: {
    maxHeight: '90%',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Manrope-SemiBold',
    color: '#000',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    top: 16,
    padding: 8,
    zIndex: 1,
  },
  scrollView: {
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
    color: '#000',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
    color: '#000',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  typeButtonSelected: {
    backgroundColor: '#f0f9e6',
    borderColor: '#B8E986',
  },
  typeButtonDisabled: {
    opacity: 0.5,
  },
  typeButtonText: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    color: '#666',
  },
  typeButtonTextSelected: {
    color: '#000',
    fontFamily: 'Manrope-SemiBold',
  },
});

