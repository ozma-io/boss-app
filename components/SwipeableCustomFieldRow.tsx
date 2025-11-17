import { CustomFieldRow } from '@/components/CustomFieldRow';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Swipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

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
  onPress: () => void;
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
  onPress,
  onDelete,
  variant = 'boss',
}: SwipeableCustomFieldRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const [isSwiping, setIsSwiping] = useState(false);

  const handleDelete = (): void => {
    swipeableRef.current?.close();
    onDelete(fieldKey);
  };

  const renderRightActions = (
    _progress: SharedValue<number>,
    drag: SharedValue<number>
  ) => {
    // Animated style for delete button - fade in as user swipes
    const deleteButtonStyle = useAnimatedStyle(() => {
      return {
        opacity: Math.min(1, Math.abs(drag.value) / 50),
      };
    });

    return (
      <Animated.View style={[styles.deleteButtonContainer, deleteButtonStyle]}>
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
  };

  // On web, render non-swipeable version (gesture-handler has limited web support)
  if (Platform.OS === 'web') {
    return (
      <View testID={`swipeable-${fieldKey.replace('custom_', '')}`}>
        <CustomFieldRow
          fieldKey={fieldKey}
          fieldValue={fieldValue}
          metadata={metadata}
          onPress={onPress}
          variant={variant}
          disabled={false}
        />
      </View>
    );
  }

  return (
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
        onPress={onPress}
        variant={variant}
        disabled={isSwiping}
      />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteButtonContainer: {
    height: '100%',
    paddingBottom: 8,
    justifyContent: 'center',
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

