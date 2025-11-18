import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet } from 'react-native';

interface DateTimePickerModalProps {
  isVisible: boolean;
  value: Date;
  mode: 'date' | 'time';
  onChange: (event: any, date?: Date) => void;
  onClose: () => void;
  testID?: string;
}

export function DateTimePickerModal({
  isVisible,
  value,
  mode,
  onChange,
  onClose,
  testID,
}: DateTimePickerModalProps) {
  if (!isVisible) return null;

  const handleChange = (event: any, date?: Date) => {
    // On Android, the native dialog handles its own dismissal
    // We need to close the picker after user interacts with it
    if (Platform.OS === 'android') {
      onClose();
    }
    onChange(event, date);
  };

  // On Android, the native dialog appears on top, so we don't need the custom overlay
  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="default"
        onChange={handleChange}
        testID={testID}
      />
    );
  }

  // iOS: Show custom overlay with inline picker
  return (
    <Pressable
      style={styles.pickerOverlay}
      onPress={onClose}
      testID={testID ? `${testID}-overlay` : 'picker-overlay'}
    >
      <Pressable
        style={styles.pickerContainer}
        onPress={(e) => e.stopPropagation()}
        testID={testID ? `${testID}-container` : 'picker-container'}
      >
        <Pressable
          style={styles.pickerCloseButton}
          onPress={onClose}
          testID={testID ? `${testID}-close-button` : 'picker-close-button'}
        >
          <Ionicons name="close" size={20} color="#000" />
        </Pressable>
        <DateTimePicker
          value={value}
          mode={mode}
          display="spinner"
          onChange={onChange}
          testID={testID}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
    zIndex: 1000,
  },
  pickerContainer: {
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
  },
  pickerCloseButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});

