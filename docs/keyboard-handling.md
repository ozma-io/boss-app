# Keyboard Handling in BossUp

## Overview

This document describes how keyboard avoidance is implemented in BossUp using `react-native-keyboard-controller` library, following best practices from the official documentation.

## Library Choice

We use **`react-native-keyboard-controller`** instead of React Native's built-in `KeyboardAvoidingView` because:

- ✅ Consistent behavior across iOS and Android
- ✅ Smoother animations
- ✅ Better support for complex layouts (chat with inverted FlatList, modals, etc.)
- ✅ Unified API for both platforms

## Architecture

### Constants (`constants/keyboard.ts`)

All keyboard-related offset values are centralized in a single file:

```typescript
import { StatusBar } from 'react-native';

// For KeyboardAwareScrollView components (forms, lists)
export const KEYBOARD_AWARE_SCROLL_OFFSET = 40;

// For KeyboardAvoidingView in chat screen (includes Android StatusBar)
export const KEYBOARD_AVOIDING_OFFSET = 100 + (StatusBar.currentHeight ?? 0);

// Helper function for dynamic offset calculation
export const getKeyboardOffsetWithStatusBar = (baseOffset: number): number => {
  return baseOffset + (StatusBar.currentHeight ?? 0);
};
```

**Why centralized?**
- Single source of truth
- Easy to adjust values project-wide
- Automatic StatusBar handling for Android
- Self-documenting code

### Component Initialization (`app/_layout.tsx`)

The `KeyboardProvider` must wrap the entire app at the root level:

```tsx
import { KeyboardProvider } from 'react-native-keyboard-controller';

<SafeAreaProvider>
  <KeyboardProvider>
    <SessionProvider>
      <AuthProvider>
        {/* ... rest of the app */}
      </AuthProvider>
    </SessionProvider>
  </KeyboardProvider>
  <Toast />
</SafeAreaProvider>
```

## Usage Patterns

### 1. KeyboardAwareScrollView (Most Common)

Use for: **Forms, profile screens, scrollable content with inputs**

```tsx
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { KEYBOARD_AWARE_SCROLL_OFFSET } from '@/constants/keyboard';

<KeyboardAwareScrollView
  style={styles.scrollView}
  bottomOffset={KEYBOARD_AWARE_SCROLL_OFFSET}
  testID="my-scroll-view"
>
  {/* Your content */}
</KeyboardAwareScrollView>
```

**Key properties:**
- `bottomOffset={KEYBOARD_AWARE_SCROLL_OFFSET}` - Space between keyboard and focused input (40px)
- No need for `extraKeyboardSpace` - library handles it automatically
- Automatically removes space when keyboard dismisses

**Current usage (screens):**
- `app/(tabs)/boss.tsx` - Boss profile screen
- `app/(tabs)/profile.tsx` - User profile screen
- `app/personal-info.tsx` - Personal info screen

**See also:** Section 3 for modal usage

### 2. KeyboardAvoidingView (Chat Screen Only)

Use for: **Chat screen with inverted FlatList**

```tsx
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { KEYBOARD_AVOIDING_OFFSET } from '@/constants/keyboard';

<KeyboardAvoidingView 
  style={styles.container} 
  behavior="padding"
  keyboardVerticalOffset={KEYBOARD_AVOIDING_OFFSET}
>
  <View style={{ flex: 1 }}>
    <FlatList
      inverted={true}
      style={{ flex: 1 }}
      {/* ... */}
    />
    <View style={styles.inputContainer}>
      <TextInput {/* ... */} />
    </View>
  </View>
</KeyboardAvoidingView>
```

**Key requirements:**
1. **Wrap content in `<View style={{ flex: 1 }}>`** - Critical for proper layout
2. **FlatList must have `style={{ flex: 1 }}`** - Prevents it from taking all space
3. **`behavior="padding"`** - Works for BOTH iOS and Android (unlike React Native's version)
4. **`keyboardVerticalOffset={KEYBOARD_AVOIDING_OFFSET}`** - Includes StatusBar height on Android

**Current usage:**
- `app/chat.tsx` - Chat screen with AI assistant

### 3. Modals with Input Fields

**Best Practice:** Use `react-native-modal` + `KeyboardAwareScrollView` inside

```tsx
import Modal from 'react-native-modal';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { KEYBOARD_AWARE_SCROLL_OFFSET } from '@/constants/keyboard';

<Modal
  isVisible={showModal}
  onBackdropPress={handleClose}
  onSwipeComplete={handleClose}
  swipeDirection={['down']}
  style={styles.modal}
  propagateSwipe
  animationIn="slideInUp"
  animationOut="slideOutDown"
  backdropOpacity={0.5}
>
  <KeyboardAwareScrollView
    style={styles.modalContent}
    contentContainerStyle={styles.modalContentContainer}
    showsVerticalScrollIndicator={false}
    bottomOffset={KEYBOARD_AWARE_SCROLL_OFFSET}
  >
    {/* Modal content with TextInput */}
  </KeyboardAwareScrollView>
</Modal>
```

**Key properties:**
- `react-native-modal` - Better animations and swipe gestures than React Native's Modal
- `KeyboardAwareScrollView` inside modal - Handles keyboard avoidance
- `onBackdropPress` / `onSwipeComplete` - Allow closing modal by tapping outside or swiping down
- Disable gestures during async operations (e.g., `onBackdropPress={isLoading ? undefined : handleClose}`)

**Current usage:**
- `components/auth/EmailAuthModal.tsx` - Authentication modal
- `components/AddTimelineEntryModal.tsx` - Timeline entry modal
- `components/AddCustomFieldModal.tsx` - Custom field modal
- `app/personal-info.tsx` - Delete account confirmation modal

### 4. KeyboardStickyView (Not Currently Used)

**When to use:** Footer that sticks to keyboard (e.g., chat input, sticky action buttons)

**When NOT to use:** 
- ❌ Do NOT combine with `KeyboardAvoidingView` - they conflict
- ❌ Do NOT use with inverted FlatList - messages will be obscured

We chose `KeyboardAvoidingView` instead because:
- Properly resizes the container
- Works correctly with inverted FlatList
- Simpler and more reliable

## Platform Differences

### iOS vs Android: Key Insights

**Behavior prop:**
- ✅ **Use `"padding"` for BOTH platforms** with `react-native-keyboard-controller`
- ❌ Do NOT use Platform.OS checks for behavior (unlike standard React Native)
- The library handles platform differences internally

**StatusBar height:**
- **iOS**: `StatusBar.currentHeight` = `undefined` → uses `0` in calculations
- **Android**: `StatusBar.currentHeight` = `24-30px` (device-dependent)
- Our constants automatically handle this with `?? 0`

**Example:**
```typescript
// iOS: 100 + 0 = 100
// Android: 100 + 24 = 124
keyboardVerticalOffset={100 + (StatusBar.currentHeight ?? 0)}
```

## Best Practices from Context7 Documentation

### 1. Consistent Behavior Across Platforms
Unlike React Native's built-in components, `react-native-keyboard-controller` provides:
- Same `behavior="padding"` for iOS and Android
- Consistent animations
- Predictable offset calculations

### 2. Optimal Offset Values
- `40-50px` for `KeyboardAwareScrollView` (we use 40px)
- `100px + StatusBar` for `KeyboardAvoidingView` in chat
- Values tested across multiple device sizes

### 3. FlatList Integration
When using `KeyboardAwareScrollView` with FlatList:
```tsx
<FlatList
  renderScrollComponent={(props) => (
    <KeyboardAwareScrollView {...props} />
  )}
/>
```
We don't use this pattern in chat because `KeyboardAvoidingView` works better with inverted FlatList.

### 4. Do Not Mix Components
- ❌ `KeyboardAvoidingView` + `KeyboardStickyView` - conflict
- ❌ `KeyboardAwareScrollView` + manual padding animations - unnecessary
- ✅ Choose ONE approach per screen

## Troubleshooting

### Input disappears when keyboard opens (iOS)

**Problem:** Input field moves off-screen when keyboard appears.

**Solution checklist:**
1. ✅ Is `KeyboardProvider` in root `_layout.tsx`?
2. ✅ Using correct import: `react-native-keyboard-controller` (not `react-native`)?
3. ✅ Content wrapped in `<View style={{ flex: 1 }}>`?
4. ✅ FlatList has `style={{ flex: 1 }}`?

### Excessive space below input (Android)

**Problem:** Large gap appears below input when keyboard is shown.

**Solution:**
- Reduce `bottomOffset` to 40-50px
- Remove `extraKeyboardSpace` prop
- Use constants from `constants/keyboard.ts`

### Chat messages covered by keyboard

**Problem:** In chat with inverted FlatList, keyboard covers messages.

**Solution:**
- Use `KeyboardAvoidingView` (not `KeyboardAwareScrollView`)
- Wrap content in `<View style={{ flex: 1 }}>`
- Add `style={{ flex: 1 }}` to FlatList
- Use `KEYBOARD_AVOIDING_OFFSET` constant

## Migration Checklist

When adding keyboard avoidance to a new screen or modal:

- [ ] Import from `react-native-keyboard-controller` (not `react-native`)
- [ ] Import offset constant from `@/constants/keyboard`
- [ ] Choose appropriate component:
  - **Screens**: `KeyboardAwareScrollView` for forms/lists
  - **Screens**: `KeyboardAvoidingView` for chat/complex layouts
  - **Modals**: Use `react-native-modal` + `KeyboardAwareScrollView` inside
- [ ] Use `KEYBOARD_AWARE_SCROLL_OFFSET` or `KEYBOARD_AVOIDING_OFFSET`
- [ ] For modals: Disable backdrop/swipe gestures during async operations
- [ ] Test on both iOS and Android
- [ ] Test on devices with different screen sizes
- [ ] Add `testID` for debugging

## References

- [react-native-keyboard-controller Documentation](https://kirillzyusko.github.io/react-native-keyboard-controller/)
- [KeyboardAvoidingView API](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-avoiding-view)
- [KeyboardAwareScrollView API](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-aware-scroll-view)
- Context7 documentation snippets used during implementation

## Version History

- **2025-11-20**: Initial documentation + Modal best practices
  - Unified keyboard offsets in constants
  - Fixed chat screen keyboard handling
  - Removed excessive offsets and unnecessary props
  - Applied Context7 best practices
  - Migrated delete account modal to react-native-modal + KeyboardAwareScrollView
  - Added modal best practices section

