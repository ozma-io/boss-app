import { TimelineEntry } from '@/types';
import { showAlert } from '@/utils/alert';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
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

interface AddTimelineEntryModalProps {
  isVisible: boolean;
  onClose: () => void;
  onAdd?: (entryData: NoteEntryData | FactEntryData) => Promise<void>;
  onUpdate?: (entryId: string, updates: Partial<TimelineEntry>) => Promise<void>;
  entryToEdit?: TimelineEntry;
}

type EntryType = 'note' | 'fact';
type NoteSubtype = 'note' | 'interaction' | 'feedback' | 'achievement' | 'challenge' | 'other';

interface NoteEntryData {
  type: 'note';
  subtype: NoteSubtype;
  title: string;
  content: string;
  icon?: string;
  timestamp: string;
}

interface FactEntryData {
  type: 'fact';
  title: string;
  content: string;
  factKey: string;
  value: string;
  icon?: string;
  timestamp: string;
}

const ENTRY_TYPES: Array<{ value: EntryType; label: string; icon: string }> = [
  { value: 'note', label: 'Note', icon: 'document-text-outline' },
  { value: 'fact', label: 'Metric', icon: 'stats-chart-outline' },
];

const NOTE_SUBTYPES: Array<{ value: NoteSubtype; label: string }> = [
  { value: 'note', label: 'Note' },
  { value: 'interaction', label: 'Interaction' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'achievement', label: 'Achievement' },
  { value: 'challenge', label: 'Challenge' },
  { value: 'other', label: 'Other' },
];

/**
 * Modal for adding or editing a timeline entry
 * Allows user to select entry type (Note or Metric) and fill in type-specific fields
 * In edit mode, entry type is locked and cannot be changed
 */
export function AddTimelineEntryModal({ isVisible, onClose, onAdd, onUpdate, entryToEdit }: AddTimelineEntryModalProps) {
  const isEditMode = !!entryToEdit;
  
  const [entryType, setEntryType] = useState<EntryType>('note');
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [noteSubtype, setNoteSubtype] = useState<NoteSubtype>('note');
  const [icon, setIcon] = useState<string>('');
  const [factKey, setFactKey] = useState<string>('');
  const [factValue, setFactValue] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Populate fields when editing
  useEffect(() => {
    if (entryToEdit) {
      setEntryType(entryToEdit.type);
      setTitle(entryToEdit.title);
      setContent(entryToEdit.content || '');
      setIcon(entryToEdit.icon || '');
      setSelectedDate(new Date(entryToEdit.timestamp));
      
      if (entryToEdit.type === 'note') {
        setNoteSubtype(entryToEdit.subtype);
      } else if (entryToEdit.type === 'fact') {
        setFactKey(entryToEdit.factKey);
        setFactValue(String(entryToEdit.value));
      }
    } else {
      // Reset to defaults when not editing
      setEntryType('note');
      setTitle('');
      setContent('');
      setNoteSubtype('note');
      setIcon('');
      setFactKey('');
      setFactValue('');
      setSelectedDate(new Date());
    }
  }, [entryToEdit, isVisible]);

  const handleClose = (): void => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleSubmit = async (): Promise<void> => {
    setIsSubmitting(true);
    try {
      if (isEditMode && entryToEdit && onUpdate) {
        // Update existing entry
        const updates: any = {
          title: title.trim(),
          content: content.trim(),
          icon: icon.trim() || undefined,
          timestamp: selectedDate.toISOString(),
        };
        
        if (entryType === 'note') {
          updates.subtype = noteSubtype;
        } else if (entryType === 'fact') {
          updates.factKey = factKey.trim();
          updates.value = factValue.trim();
        }
        
        await onUpdate(entryToEdit.id, updates);
      } else if (onAdd) {
        // Create new entry
        if (entryType === 'note') {
          const entryData: NoteEntryData = {
            type: 'note',
            subtype: noteSubtype,
            title: title.trim(),
            content: content.trim(),
            icon: icon.trim() || undefined,
            timestamp: selectedDate.toISOString(),
          };
          await onAdd(entryData);
        } else {
          const entryData: FactEntryData = {
            type: 'fact',
            title: title.trim(),
            content: content.trim(),
            factKey: factKey.trim(),
            value: factValue.trim(),
            icon: icon.trim() || undefined,
            timestamp: selectedDate.toISOString(),
          };
          await onAdd(entryData);
        }
      }
      handleClose();
    } catch (error) {
      showAlert(
        'Something went wrong',
        isEditMode 
          ? 'We couldn\'t update this entry right now. Our team has been notified and is working on it. Please try again later.'
          : 'We couldn\'t add this entry right now. Our team has been notified and is working on it. Please try again later.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = (): boolean => {
    if (!title.trim()) return false;
    if (entryType === 'fact' && (!factKey.trim() || !factValue.trim())) return false;
    return true;
  };

  const handleDateChange = (event: any, date?: Date): void => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleTimeChange = (event: any, date?: Date): void => {
    setShowTimePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
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
        <View style={styles.modalContent} testID="add-timeline-entry-modal">
          <View style={styles.header}>
            <View style={styles.dragHandle} />
            <Text style={styles.title} testID="modal-title">
              {isEditMode ? 'Edit Timeline Entry' : 'Add Timeline Entry'}
            </Text>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Date/Time Pickers - First */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel} testID="timestamp-section-label">
                Date & Time
              </Text>
              <View style={styles.dateTimeRow}>
                <Pressable
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                  testID="date-picker-button"
                >
                  <Ionicons name="calendar-outline" size={20} color="#666" />
                  <Text style={styles.dateTimeText}>{formatDate(selectedDate)}</Text>
                </Pressable>
                <Pressable
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                  testID="time-picker-button"
                >
                  <Ionicons name="time-outline" size={20} color="#666" />
                  <Text style={styles.dateTimeText}>{formatTime(selectedDate)}</Text>
                </Pressable>
              </View>
            </View>

            {/* Entry Type Selector */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel} testID="type-section-label">
                Entry Type
              </Text>
              <View style={styles.typeGrid}>
                {ENTRY_TYPES.map((type) => (
                  <Pressable
                    key={type.value}
                    style={[
                      styles.typeCard,
                      entryType === type.value && styles.typeCardSelected,
                      isEditMode && styles.typeCardDisabled,
                    ]}
                    onPress={() => {
                      if (isEditMode) {
                        showAlert(
                          'Cannot Change Entry Type',
                          'Unfortunately, changing the entry type is not possible yet. This feature will be available in future versions. For now, you can delete this entry and create a new one.'
                        );
                      } else {
                        setEntryType(type.value);
                      }
                    }}
                    testID={`entry-type-${type.value}`}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={24}
                      color={entryType === type.value ? '#B8E986' : '#666'}
                    />
                    <Text
                      style={[
                        styles.typeLabel,
                        entryType === type.value && styles.typeLabelSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Note-specific fields */}
            {entryType === 'note' && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionLabel} testID="subtype-section-label">
                    Subtype
                  </Text>
                  <View style={styles.subtypeButtons}>
                    {NOTE_SUBTYPES.map((subtype) => (
                      <Pressable
                        key={subtype.value}
                        style={[
                          styles.subtypeButton,
                          noteSubtype === subtype.value && styles.subtypeButtonSelected,
                        ]}
                        onPress={() => setNoteSubtype(subtype.value)}
                        testID={`subtype-${subtype.value}`}
                      >
                        <Text
                          style={[
                            styles.subtypeButtonText,
                            noteSubtype === subtype.value && styles.subtypeButtonTextSelected,
                          ]}
                        >
                          {subtype.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel} testID="title-section-label">
                    Title *
                  </Text>
                  <TextInput
                    style={[styles.input, { outlineStyle: 'none' } as any]}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g., Weekly 1-on-1 Meeting"
                    placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    testID="title-input"
                    autoFocus
                  />
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel} testID="content-section-label">
                    Content
                  </Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput, { outlineStyle: 'none' } as any]}
                    value={content}
                    onChangeText={setContent}
                    placeholder="Enter details..."
                    placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    multiline
                    testID="content-input"
                  />
                </View>

                {/* TODO: Add icon picker UI for users to select custom icons
                <View style={styles.section}>
                  <Text style={styles.sectionLabel} testID="icon-section-label">
                    Icon (Optional)
                  </Text>
                  <TextInput
                    style={[styles.input, { outlineStyle: 'none' } as any]}
                    value={icon}
                    onChangeText={setIcon}
                    placeholder="e.g., 💬 or 🎯"
                    placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    testID="icon-input"
                  />
                </View>
                */}
              </>
            )}

            {/* Fact-specific fields */}
            {entryType === 'fact' && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionLabel} testID="title-section-label">
                    Title *
                  </Text>
                  <TextInput
                    style={[styles.input, { outlineStyle: 'none' } as any]}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g., Weekly 1-on-1 Meeting"
                    placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    testID="title-input"
                    autoFocus
                  />
                </View>

                <View style={styles.section}>
                  <View style={styles.labelWithInfo}>
                    <Text style={styles.sectionLabel} testID="fact-key-section-label">
                      Fact Key *
                    </Text>
                    <Pressable
                      onPress={() =>
                        showAlert(
                          'About Fact Keys',
                          'This unique key identifies the metric. Data will be tracked and graphed by this key.'
                        )
                      }
                      testID="fact-key-info-button"
                    >
                      <Ionicons name="information-circle-outline" size={20} color="#666" />
                    </Pressable>
                  </View>
                  <TextInput
                    style={[styles.input, { outlineStyle: 'none' } as any]}
                    value={factKey}
                    onChangeText={setFactKey}
                    placeholder="e.g., mood_score, stress_level"
                    placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    testID="fact-key-input"
                  />
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel} testID="value-section-label">
                    Value *
                  </Text>
                  <TextInput
                    style={[styles.input, { outlineStyle: 'none' } as any]}
                    value={factValue}
                    onChangeText={setFactValue}
                    placeholder="e.g., 8, High, Good"
                    placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    testID="value-input"
                  />
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel} testID="content-section-label">
                    Content
                  </Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput, { outlineStyle: 'none' } as any]}
                    value={content}
                    onChangeText={setContent}
                    placeholder="Enter details..."
                    placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    multiline
                    testID="content-input"
                  />
                </View>

                {/* TODO: Add icon picker UI for users to select custom icons
                <View style={styles.section}>
                  <Text style={styles.sectionLabel} testID="icon-section-label">
                    Icon (Optional)
                  </Text>
                  <TextInput
                    style={[styles.input, { outlineStyle: 'none' } as any]}
                    value={icon}
                    onChangeText={setIcon}
                    placeholder="e.g., 📊 or 📈"
                    placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    testID="icon-input"
                  />
                </View>
                */}
              </>
            )}
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
                (isSubmitting || !isFormValid()) && styles.buttonDisabled
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || !isFormValid()}
              testID="add-entry-button"
            >
              <Text style={styles.addButtonText}>
                {isSubmitting 
                  ? (isEditMode ? 'Saving...' : 'Adding...') 
                  : (isEditMode ? 'Save Changes' : 'Add Entry')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Date Picker */}
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              testID="date-picker"
            />
          )}

          {/* Time Picker */}
          {showTimePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
              testID="time-picker"
            />
          )}
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
  labelWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    minHeight: 100,
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
  subtypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subtypeButton: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  subtypeButtonSelected: {
    backgroundColor: '#f0f9e6',
    borderColor: '#B8E986',
  },
  subtypeButtonText: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    color: '#666',
  },
  subtypeButtonTextSelected: {
    color: '#000',
    fontFamily: 'Manrope-SemiBold',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  dateTimeText: {
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
    color: '#000',
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

