import { KEYBOARD_AWARE_SCROLL_OFFSET } from '@/constants/keyboard';
import { logger } from '@/services/logger.service';
import { TimelineEntry } from '@/types';
import { showAlert } from '@/utils/alert';
import { Ionicons } from '@expo/vector-icons';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Modal from 'react-native-modal';
import { DateTimePickerModal } from './DateTimePickerModal';

interface AddTimelineEntryModalProps {
  isVisible: boolean;
  onClose: () => void;
  onCreateEmpty?: () => Promise<string>;
  onUpdate?: (entryId: string, updates: Partial<TimelineEntry>) => Promise<void>;
  entryToEdit?: TimelineEntry;
}

type NoteSubtype = 'note' | 'interaction' | 'feedback' | 'achievement' | 'challenge' | 'other';

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
export function AddTimelineEntryModal({ isVisible, onClose, onCreateEmpty, onUpdate, entryToEdit }: AddTimelineEntryModalProps): React.JSX.Element {
  const isEditMode = !!entryToEdit;
  
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [noteSubtype, setNoteSubtype] = useState<NoteSubtype>('note');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  // Create empty entry or populate fields when editing
  useEffect(() => {
    if (!isVisible) return;
    
    if (entryToEdit) {
      // Edit mode: populate fields
      setCurrentEntryId(entryToEdit.id);
      setTitle(entryToEdit.title);
      setContent(entryToEdit.content || '');
      setSelectedDate(new Date(entryToEdit.timestamp));
      
      if (entryToEdit.type === 'note') {
        setNoteSubtype(entryToEdit.subtype);
      }
    } else {
      // Create mode: create empty entry immediately
      const createEmpty = async (): Promise<void> => {
        if (onCreateEmpty && !currentEntryId) {
          try {
            const newEntryId = await onCreateEmpty();
            setCurrentEntryId(newEntryId);
          } catch (error) {
            logger.error('Failed to create empty timeline entry', { feature: 'AddTimelineEntryModal', error });
            showAlert(
              'Something went wrong',
              'We couldn\'t create this entry right now. Our team has been notified and is working on it. Please try again later.'
            );
            onClose();
          }
        }
      };
      
      // Reset to defaults
      setTitle('');
      setContent('');
      setNoteSubtype('note');
      setSelectedDate(new Date());
      
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
  
  // Auto-save function
  const autoSave = useCallback(async (updates: Partial<TimelineEntry>): Promise<void> => {
    if (!currentEntryId || !onUpdate) return;
    
    try {
      await onUpdate(currentEntryId, updates);
    } catch (error) {
      // Silent fail - user can retry by changing field again
      logger.error('Failed to auto-save timeline entry', { feature: 'AddTimelineEntryModal', entryId: currentEntryId, updates, error });
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
  
  // Immediate auto-save for noteSubtype
  useEffect(() => {
    if (!currentEntryId) return;
    autoSave({ subtype: noteSubtype });
  }, [noteSubtype, currentEntryId, autoSave]);

  const handleDateChange = (event: DateTimePickerEvent, date?: Date): void => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleTimeChange = (event: DateTimePickerEvent, date?: Date): void => {
    if (date) {
      setSelectedDate(date);
    }
  };
  
  // Immediate auto-save for timestamp (date/time)
  useEffect(() => {
    if (!currentEntryId) return;
    autoSave({ timestamp: selectedDate.toISOString() });
  }, [selectedDate, currentEntryId, autoSave]);

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
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropOpacity={0.35}
    >
      <KeyboardAwareScrollView 
        style={styles.keyboardView} 
        contentContainerStyle={styles.modalContent} 
        showsVerticalScrollIndicator={false} 
        bottomOffset={KEYBOARD_AWARE_SCROLL_OFFSET}
        testID="add-timeline-entry-modal"
      >
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

        <View style={styles.scrollView}>
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

            {/* Note fields */}
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
                    style={[
                      styles.input, 
                      // Web-specific style: React Native Web supports outlineStyle: 'none' to remove focus outline,
                      // but it's not in React Native's type definitions (which only supports 'solid', 'dotted', 'dashed')
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      { outlineStyle: 'none' } as any
                    ]}
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
                    style={[
                      styles.input, 
                      styles.multilineInput, 
                      // Web-specific style: React Native Web supports outlineStyle: 'none' to remove focus outline,
                      // but it's not in React Native's type definitions (which only supports 'solid', 'dotted', 'dashed')
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      { outlineStyle: 'none' } as any
                    ]}
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
        </View>

        {/* Date Picker */}
        <DateTimePickerModal
          isVisible={showDatePicker}
          value={selectedDate}
          mode="date"
          onChange={handleDateChange}
          onClose={() => setShowDatePicker(false)}
          testID="date-picker"
        />

        {/* Time Picker */}
        <DateTimePickerModal
          isVisible={showTimePicker}
          value={selectedDate}
          mode="time"
          onChange={handleTimeChange}
          onClose={() => setShowTimePicker(false)}
          testID="time-picker"
        />
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
});

