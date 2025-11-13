import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface AddCustomFieldButtonProps {
  onPress: () => void;
  testID?: string;
}

/**
 * Circular button with green plus icon for adding custom fields
 * White background with shadow, centered below field list
 */
export function AddCustomFieldButton({ onPress, testID = 'add-custom-field-button' }: AddCustomFieldButtonProps) {
  return (
    <View style={styles.container} testID={`${testID}-container`}>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.7}
        testID={testID}
      >
        <Ionicons name="add-circle" size={48} color="#B8E986" testID={`${testID}-icon`} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

