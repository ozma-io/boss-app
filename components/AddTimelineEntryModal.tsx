import { TimelineEntry } from '@/types';
import { showAlert } from '@/utils/alert';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Modal from 'react-native-modal';

interface AddTimelineEntryModalProps {
  isVisible: boolean;
  onClose: () => void;
  onCreateEmpty?: () => Promise<string>;
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
 * Creates empty entry immediately on open, auto-saves all changes
 * Entry type can be changed anytime with field state preservation
 */
export function AddTimelineEntryModal({ isVisible, onClose, onCreateEmpty, onUpdate, entryToEdit }: AddTimelineEntryModalProps) {
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
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  
  // State preservation for type switching
  const [savedNoteFields, setSavedNoteFields] = useState<{
    title: string;
    content: string;
    subtype: NoteSubtype;
  } | null>(null);
  const [savedFactFields, setSavedFactFields] = useState<{
    title: string;
    content: string;
    factKey: string;
    factValue: string;
  } | null>(null);

  // Create empty entry or populate fields when editing
  useEffect(() => {
    if (!isVisible) return;
    
    if (entryToEdit) {
      // Edit mode: populate fields
      setCurrentEntryId(entryToEdit.id);
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
      // Create mode: create empty entry immediately
      const createEmpty = async (): Promise<void> => {
        if (onCreateEmpty && !currentEntryId) {
          try {
            const newEntryId = await onCreateEmpty();
            setCurrentEntryId(newEntryId);
          } catch (error) {
            showAlert(
              'Something went wrong',
              'We couldn\'t create this entry right now. Our team has been notified and is working on it. Please try again later.'
            );
            onClose();
          }
        }
      };
      
      // Reset to defaults
      setEntryType('note');
      setTitle('');
      setContent('');
      setNoteSubtype('note');
      setIcon('');
      setFactKey('');
      setFactValue('');
      setSelectedDate(new Date());
      setSavedNoteFields(null);
      setSavedFactFields(null);
      
      createEmpty();
    }
  }, [entryToEdit, isVisible, onCreateEmpty, onClose]);
  
  // Reset currentEntryId when modal closes
  useEffect(() => {
    if (!isVisible) {
      setCurrentEntryId(null);
    }
  }, [isVisible]);

  const handleClose = (): void => {
    onClose();
  };
  
  // Debounce timer refs
  const titleDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const factKeyDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const factValueDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Auto-save function
  const autoSave = useCallback(async (updates: Partial<TimelineEntry>): Promise<void> => {
    if (!currentEntryId || !onUpdate) return;
    
    try {
      await onUpdate(currentEntryId, updates);
    } catch (error) {
      // Silent fail - user can retry by changing field again
    }
  }, [currentEntryId, onUpdate]);
  
  // Debounced auto-save for title
  useEffect(() => {
    if (!currentEntryId) return;
    
    if (titleDebounceTimer.current) {
      clearTimeout(titleDebounceTimer.current);
    }
    
    titleDebounceTimer.current = setTimeout(() => {
      autoSave({ title });
    }, 500);
    
    return () => {
      if (titleDebounceTimer.current) {
        clearTimeout(titleDebounceTimer.current);
      }
    };
  }, [title, currentEntryId, autoSave]);
  
  // Debounced auto-save for content
  useEffect(() => {
    if (!currentEntryId) return;
    
    if (contentDebounceTimer.current) {
      clearTimeout(contentDebounceTimer.current);
    }
    
    contentDebounceTimer.current = setTimeout(() => {
      autoSave({ content });
    }, 500);
    
    return () => {
      if (contentDebounceTimer.current) {
        clearTimeout(contentDebounceTimer.current);
      }
    };
  }, [content, currentEntryId, autoSave]);
  
  // Debounced auto-save for factKey
  useEffect(() => {
    if (!currentEntryId || entryType !== 'fact') return;
    
    if (factKeyDebounceTimer.current) {
      clearTimeout(factKeyDebounceTimer.current);
    }
    
    factKeyDebounceTimer.current = setTimeout(() => {
      autoSave({ factKey } as any);
    }, 500);
    
    return () => {
      if (factKeyDebounceTimer.current) {
        clearTimeout(factKeyDebounceTimer.current);
      }
    };
  }, [factKey, currentEntryId, entryType, autoSave]);
  
  // Debounced auto-save for factValue
  useEffect(() => {
    if (!currentEntryId || entryType !== 'fact') return;
    
    if (factValueDebounceTimer.current) {
      clearTimeout(factValueDebounceTimer.current);
    }
    
    factValueDebounceTimer.current = setTimeout(() => {
      autoSave({ value: factValue } as any);
    }, 500);
    
    return () => {
      if (factValueDebounceTimer.current) {
        clearTimeout(factValueDebounceTimer.current);
      }
    };
  }, [factValue, currentEntryId, entryType, autoSave]);
  
  // Immediate auto-save for noteSubtype
  useEffect(() => {
    if (!currentEntryId || entryType !== 'note') return;
    autoSave({ subtype: noteSubtype } as any);
  }, [noteSubtype, currentEntryId, entryType, autoSave]);

  const handleDateChange = (event: any, date?: Date): void => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleTimeChange = (event: any, date?: Date): void => {
    if (date) {
      setSelectedDate(date);
    }
  };
  
  // Immediate auto-save for timestamp (date/time)
  useEffect(() => {
    if (!currentEntryId) return;
    autoSave({ timestamp: selectedDate.toISOString() });
  }, [selectedDate, currentEntryId, autoSave]);
  
  // Handle entry type switching with state preservation
  const handleEntryTypeChange = (newType: EntryType): void => {
    if (newType === entryType) return;
    
    // Save current fields before switching
    if (entryType === 'note') {
      setSavedNoteFields({
        title,
        content,
        subtype: noteSubtype,
      });
    } else if (entryType === 'fact') {
      setSavedFactFields({
        title,
        content,
        factKey,
        factValue,
      });
    }
    
    // Switch type
    const oldType = entryType;
    setEntryType(newType);
    
    // Restore saved fields or set defaults
    if (newType === 'note') {
      if (savedNoteFields) {
        setTitle(savedNoteFields.title);
        setContent(savedNoteFields.content);
        setNoteSubtype(savedNoteFields.subtype);
      } else {
        // Keep title and content, reset note-specific fields
        setNoteSubtype('note');
      }
    } else if (newType === 'fact') {
      if (savedFactFields) {
        setTitle(savedFactFields.title);
        setContent(savedFactFields.content);
        setFactKey(savedFactFields.factKey);
        setFactValue(savedFactFields.factValue);
      } else {
        // Keep title and content, reset fact-specific fields
        setFactKey('');
        setFactValue('');
      }
    }
    
    // Update entry type in database
    if (currentEntryId && onUpdate) {
      onUpdate(currentEntryId, { type: newType } as any);
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
            <Pressable
              style={styles.closeButton}
              onPress={handleClose}
              testID="close-button"
            >
              <Ionicons name="close" size={28} color="#000" />
            </Pressable>
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
                  onPress={() => {
                    setShowTimePicker(false);
                    setShowDatePicker(true);
                  }}
                  testID="date-picker-button"
                >
                  <Ionicons name="calendar-outline" size={20} color="#666" />
                  <Text style={styles.dateTimeText}>{formatDate(selectedDate)}</Text>
                </Pressable>
                <Pressable
                  style={styles.dateTimeButton}
                  onPress={() => {
                    setShowDatePicker(false);
                    setShowTimePicker(true);
                  }}
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
              <View style={styles.typeButtons}>
                {ENTRY_TYPES.map((type) => (
                  <Pressable
                    key={type.value}
                    style={[
                      styles.typeButton,
                      entryType === type.value && styles.typeButtonSelected,
                    ]}
                    onPress={() => handleEntryTypeChange(type.value)}
                    testID={`entry-type-${type.value}`}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={20}
                      color={entryType === type.value ? '#B8E986' : '#666'}
                    />
                    <Text
                      style={[
                        styles.typeButtonText,
                        entryType === type.value && styles.typeButtonTextSelected,
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
                    Title
                  </Text>
                  <TextInput
                    style={[styles.input, { outlineStyle: 'none' } as any]}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g., Weekly 1-on-1 Meeting"
                    placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    testID="title-input"
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
                    Title
                  </Text>
                  <TextInput
                    style={[styles.input, { outlineStyle: 'none' } as any]}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g., Weekly 1-on-1 Meeting"
                    placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    testID="title-input"
                  />
                </View>

                <View style={styles.section}>
                  <View style={styles.labelWithInfo}>
                    <Text style={styles.sectionLabel} testID="fact-key-section-label">
                      Fact Key
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
                    Value
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

          {/* Date Picker */}
          {showDatePicker && (
            <Pressable
              style={styles.pickerOverlay}
              onPress={() => setShowDatePicker(false)}
              testID="date-picker-overlay"
            >
              <Pressable
                style={styles.pickerContainer}
                onPress={(e) => e.stopPropagation()}
                testID="date-picker-container"
              >
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                  testID="date-picker"
                />
              </Pressable>
            </Pressable>
          )}

          {/* Time Picker */}
          {showTimePicker && (
            <Pressable
              style={styles.pickerOverlay}
              onPress={() => setShowTimePicker(false)}
              testID="time-picker-overlay"
            >
              <Pressable
                style={styles.pickerContainer}
                onPress={(e) => e.stopPropagation()}
                testID="time-picker-container"
              >
                <DateTimePicker
                  value={selectedDate}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleTimeChange}
                  testID="time-picker"
                />
              </Pressable>
            </Pressable>
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
  typeButtonText: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    color: '#666',
  },
  typeButtonTextSelected: {
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
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
  },
});

