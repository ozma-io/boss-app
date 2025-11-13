import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert helper
 * Uses native Alert on mobile and window.alert/confirm on web
 */
export function showAlert(title: string, message: string, buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>): void {
  if (Platform.OS === 'web') {
    // On web, use window.alert or window.confirm
    if (buttons && buttons.length > 1) {
      // Multiple buttons - use confirm
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed && buttons.find(b => b.style !== 'cancel')?.onPress) {
        buttons.find(b => b.style !== 'cancel')?.onPress?.();
      } else if (!confirmed && buttons.find(b => b.style === 'cancel')?.onPress) {
        buttons.find(b => b.style === 'cancel')?.onPress?.();
      }
    } else {
      // Single button or no buttons - use alert
      window.alert(`${title}\n\n${message}`);
      if (buttons && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
    }
  } else {
    // On mobile, use native Alert
    if (buttons) {
      Alert.alert(title, message, buttons);
    } else {
      Alert.alert(title, message);
    }
  }
}

