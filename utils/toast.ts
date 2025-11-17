import Toast from 'react-native-toast-message';

/**
 * Cross-platform toast notification helper
 * Shows a temporary message that disappears automatically
 * Uses react-native-toast-message library for consistent UI across all platforms
 * 
 * @param message - The message to display
 * @param duration - Duration in milliseconds (default: 2000ms)
 */
export function showToast(message: string, duration: number = 2000): void {
  Toast.show({
    type: 'success',
    text1: message,
    visibilityTime: duration,
    position: 'bottom',
  });
}

