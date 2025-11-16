import { CustomFieldRow } from '@/components/CustomFieldRow';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Swipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated from 'react-native-reanimated';

interface FieldMetadata {
  label: string;
  type: 'text' | 'select' | 'date' | 'multiline' | 'multiselect';
  category?: string;
  source?: string;
  createdAt: string;
  displayOrder?: number;
  options?: string[];
}

interface SwipeableCustomFieldRowProps {
  fieldKey: string;
  fieldValue: any;
  metadata: FieldMetadata;
  onUpdate: (fieldKey: string, value: any) => Promise<void>;
  onDelete: (fieldKey: string) => void;
  variant?: 'boss' | 'profile';
}

/**
 * Swipeable wrapper for CustomFieldRow with delete action on swipe left
 * Displays red background with trash icon when swiped
 */
export function SwipeableCustomFieldRow({
  fieldKey,
  fieldValue,
  metadata,
  onUpdate,
  onDelete,
  variant = 'boss',
}: SwipeableCustomFieldRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const [isSwiping, setIsSwiping] = useState(false);

  const handleDelete = (): void => {
    swipeableRef.current?.close();
    onDelete(fieldKey);
  };

  const renderRightActions = () => (
    <Animated.View style={styles.deleteButtonContainer}>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDelete}
        activeOpacity={0.8}
        testID={`delete-button-${fieldKey.replace('custom_', '')}`}
      >
        <Ionicons name="trash" size={24} color="#fff" />
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.swipeableContainer}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        overshootRight={false}
        onSwipeableWillOpen={() => setIsSwiping(true)}
        onSwipeableClose={() => setIsSwiping(false)}
        testID={`swipeable-${fieldKey.replace('custom_', '')}`}
      >
        <CustomFieldRow
          fieldKey={fieldKey}
          fieldValue={fieldValue}
          metadata={metadata}
          onUpdate={onUpdate}
          variant={variant}
          disabled={isSwiping}
        />
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeableContainer: {
    zIndex: 999,
    elevation: 5,
  },
  deleteButtonContainer: {
    height: '100%',
    paddingBottom: 8,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    height: '100%',
    borderRadius: 16,
    marginLeft: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    marginTop: 4,
  },
});

