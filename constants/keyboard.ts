import { StatusBar } from 'react-native';

/**
 * Keyboard offset constants for consistent keyboard avoidance behavior
 * Based on react-native-keyboard-controller best practices
 * 
 * @see https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-avoiding-view
 */

/**
 * Base offset for KeyboardAwareScrollView components
 * Recommended range: 40-50px
 */
export const KEYBOARD_AWARE_SCROLL_OFFSET = 40;

/**
 * Offset for KeyboardAvoidingView in chat screen
 * Includes StatusBar height on Android for proper positioning
 */
export const KEYBOARD_AVOIDING_OFFSET = 100 + (StatusBar.currentHeight ?? 0);

/**
 * Get keyboard offset with StatusBar height included (Android only)
 * Use this when you need dynamic offset calculation
 * 
 * @param baseOffset - Base offset value in pixels
 * @returns Total offset including StatusBar height on Android
 */
export const getKeyboardOffsetWithStatusBar = (baseOffset: number): number => {
  return baseOffset + (StatusBar.currentHeight ?? 0);
};

