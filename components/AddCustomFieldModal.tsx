import { showAlert } from '@/utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Modal from 'react-native-modal';

interface AddCustomFieldModalProps {
  isVisible: boolean;
  onClose: () => void;
  onAdd: (label: string, type: FieldType, initialValue: string) => Promise<void>;
}

type FieldType = 'text' | 'multiline' | 'select' | 'date';

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
 * Allows user to input label, select field type, and optionally provide initial value
 */
export function AddCustomFieldModal({ isVisible, onClose, onAdd }: AddCustomFieldModalProps) {
  const [label, setLabel] = useState<string>('');
  const [selectedType, setSelectedType] = useState<FieldType>('text');
  const [initialValue, setInitialValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleClose = (): void => {
    if (!isSubmitting) {
      setLabel('');
      setSelectedType('text');
      setInitialValue('');
      onClose();
    }
  };

  const handleAdd = async (): Promise<void> => {
    setIsSubmitting(true);
    try {
      await onAdd(label.trim(), selectedType, initialValue.trim());
      handleClose();
    } catch (error) {
      showAlert(
        'Something went wrong',
        'We couldn\'t add this field right now. Our team has been notified and is working on it. Please try again later.'
      );
    } finally {
      setIsSubmitting(false);
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.modalContent} testID="add-custom-field-modal">
          <View style={styles.header}>
            <View style={styles.dragHandle} />
            <Text style={styles.title} testID="modal-title">
              Add Custom Field
            </Text>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel} testID="label-section-label">
                Field Label *
              </Text>
              <TextInput
                style={[styles.input, { outlineStyle: 'none' } as any]}
                value={label}
                onChangeText={setLabel}
                placeholder="e.g., Pet Name, Favorite Color"
                placeholderTextColor="rgba(0, 0, 0, 0.3)"
                testID="field-label-input"
                autoFocus
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel} testID="type-section-label">
                Field Type
              </Text>
              <View style={styles.typeGrid}>
                {FIELD_TYPES.map((type) => (
                  <Pressable
                    key={type.value}
                    style={[
                      styles.typeCard,
                      selectedType === type.value && styles.typeCardSelected,
                      !type.enabled && styles.typeCardDisabled,
                    ]}
                    onPress={() => type.enabled && setSelectedType(type.value)}
                    disabled={!type.enabled}
                    testID={`type-option-${type.value}`}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={24}
                      color={selectedType === type.value ? '#B8E986' : '#666'}
                    />
                    <Text
                      style={[
                        styles.typeLabel,
                        selectedType === type.value && styles.typeLabelSelected,
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
                Initial Value (Optional)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  selectedType === 'multiline' && styles.multilineInput,
                  { outlineStyle: 'none' } as any,
                ]}
                value={initialValue}
                onChangeText={setInitialValue}
                placeholder="Enter initial value..."
                placeholderTextColor="rgba(0, 0, 0, 0.3)"
                multiline={selectedType === 'multiline'}
                numberOfLines={selectedType === 'multiline' ? 3 : 1}
                testID="initial-value-input"
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isSubmitting}
              testID="cancel-button"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.addButton,
                (isSubmitting || !label.trim()) && styles.buttonDisabled
              ]}
              onPress={handleAdd}
              disabled={isSubmitting || !label.trim()}
              testID="add-button"
            >
              <Text style={styles.addButtonText}>
                {isSubmitting ? 'Adding...' : 'Add Field'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    maxHeight: '90%',
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e8e8e8',
  },
  typeCardSelected: {
    backgroundColor: '#f0f9e6',
    borderColor: '#B8E986',
  },
  typeCardDisabled: {
    opacity: 0.5,
  },
  typeLabel: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  typeLabelSelected: {
    color: '#000',
    fontFamily: 'Manrope-SemiBold',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f8f8',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    color: '#666',
  },
  addButton: {
    backgroundColor: '#B8E986',
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    color: '#000',
  },
  buttonDisabled: {
    opacity: 0.3,
  },
});

