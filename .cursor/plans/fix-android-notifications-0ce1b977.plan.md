<!-- 0ce1b977-e7df-4a9c-a8d5-95a84fad6355 1da2928d-5794-4465-ba5e-970c2dd79021 -->
# Fix Android Push Notifications

## Overview

Fix critical Android notification issues identified through Context7 documentation review:

1. Missing foreground message handler (notifications disappear when app is open)
2. Android 13+ permission request should use PermissionsAndroid API
3. Missing Firebase Messaging channel configuration
4. Duplicate permission check in FCM token registration
5. Notification channel sound configuration

## Changes

### 1. Add Foreground Message Handler (app/_layout.tsx)

**Location:** Add new useEffect in `RootLayoutNav` component after line 317 (after existing FCM token registration effect)

**Add:**

```typescript
// Handle foreground FCM messages - display notification when app is open
useEffect(() => {
  if (Platform.OS === 'web') return;

  const setupForegroundHandler = async () => {
    const messagingModule = require('@react-native-firebase/messaging/lib/modular');
    const { getMessaging, onMessage } = messagingModule;
    const messaging = getMessaging();

    const unsubscribe = onMessage(messaging, async (remoteMessage: any) => {
      logger.info('FCM message received in foreground', { 
        feature: 'RootLayout',
        title: remoteMessage.notification?.title 
      });

      // Display notification using expo-notifications
      await Notifications.scheduleNotificationAsync({
        content: {
          title: remoteMessage.notification?.title || 'New message',
          body: remoteMessage.notification?.body || '',
          data: remoteMessage.data,
        },
        trigger: null, // Show immediately
      });
    });

    return unsubscribe;
  };

  const unsubscribePromise = setupForegroundHandler();

  return () => {
    unsubscribePromise.then((unsubscribe) => {
      if (unsubscribe) {
        unsubscribe();
      }
    });
  };
}, []);
```

**Why:** Firebase Messaging does NOT automatically display notifications when app is in foreground. We must manually show them using expo-notifications.

### 2. Update Permission Request (services/notification.service.ts)

**Current code (lines 38-59):**

```typescript
} else if (Platform.OS === 'android') {
  if (!Notifications) {
    logger.warn('Notifications module not available', { feature: 'Notification' });
    return 'not_asked';
  }
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  
  if (existingStatus === 'granted') {
    return 'granted';
  }

  const { status } = await Notifications.requestPermissionsAsync();

  if (status === 'granted') {
    return 'granted';
  } else if (status === 'denied') {
    return 'denied';
  } else {
    return 'denied';
  }
}
```

**Replace with:**

```typescript
} else if (Platform.OS === 'android') {
  // Import PermissionsAndroid at the top of the file (add after line 2):
  // import { Platform, PermissionsAndroid } from 'react-native';
  
  if (!Notifications) {
    logger.warn('Notifications module not available', { feature: 'Notification' });
    return 'not_asked';
  }
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  
  if (existingStatus === 'granted') {
    return 'granted';
  }

  // Use native Android API for Android 13+ (API 33+)
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );

  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return 'granted';
  } else if (result === PermissionsAndroid.RESULTS.DENIED || result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    return 'denied';
  } else {
    return 'denied';
  }
}
```

**Also update import at line 3:**

```typescript
import { Platform, PermissionsAndroid } from 'react-native';
```

**Why:** Per React Native Firebase documentation, Android 13+ (API 33+) should use PermissionsAndroid.request() for POST_NOTIFICATIONS permission.

### 3. Remove Duplicate Permission Check (services/notification.service.ts)

**Current code (lines 130-139):**

```typescript
// Request permission first (required for iOS)
const authStatus = await requestPermissionFn(messaging);
const enabled =
  authStatus === AuthorizationStatus.AUTHORIZED ||
  authStatus === AuthorizationStatus.PROVISIONAL;

if (!enabled) {
  logger.warn('Firebase Messaging permission not granted', { feature: 'NotificationService' });
  return;
}
```

**Delete these lines** (130-139) because permission is already requested in `requestNotificationPermissions()` before this function is called.

**Update function documentation comment (line 116-119) to:**

```typescript
/**
 * Get FCM token from Firebase and save it to Firestore
 * Should be called ONLY after notification permission is already granted
 */
```

**Why:** Permission is already checked before calling this function. On iOS, requesting permission twice is redundant; on Android, it can cause issues.

### 4. Update Notification Channel Sound (app/_layout.tsx)

**Current code (line 122):**

```typescript
sound: 'default',
```

**Replace with:**

```typescript
sound: true,
```

**Why:** Per Expo Notifications documentation, use `true` for default system sound or a filename for custom sound. String `'default'` may not work correctly.

### 5. Add Firebase Messaging Configuration (firebase.json)

**Current file content (lines 1-57):** Only has firestore, functions, remoteconfig, and hosting

**Add new section after line 7 (after firestore config), before functions:**

```json
"react-native": {
  "messaging_android_notification_channel_id": "chat_messages",
  "messaging_ios_foreground_presentation_options": ["badge", "sound", "alert", "list", "banner"]
}
```

**Full change:**

```json
{
  "firestore": {
    "database": "(default)",
    "location": "us-central1",
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "react-native": {
    "messaging_android_notification_channel_id": "chat_messages",
    "messaging_ios_foreground_presentation_options": ["badge", "sound", "alert", "list", "banner"]
  },
  "functions": [
    ...
```

**Why:**

- Android: Tells Firebase Messaging to use our custom "chat_messages" channel for notifications
- iOS: Configures foreground presentation (banner, sound, etc.) when messages arrive while app is open

## Verification

After changes:

1. Test Android foreground: Open app → send notification → should appear as banner
2. Test Android background: Close app → send notification → should arrive normally
3. Test iOS foreground: Open app → send notification → should show banner with sound
4. Test iOS background: Close app → send notification → should arrive normally
5. Check logs for "FCM message received in foreground" when testing

## Files Changed

- `app/_layout.tsx` - Add foreground message handler, fix sound config
- `services/notification.service.ts` - Use PermissionsAndroid, remove duplicate permission check
- `firebase.json` - Add Firebase Messaging configuration

## What's Already Correct (No Changes)

- `functions/src/chat.ts` line 621: `channelId: 'chat_messages'` ✓ Correct
- Modular API usage: Intentional for web compatibility ✓ Keep as-is
- `setNotificationHandler`: For local notifications ✓ Working correctly
- Background message handler in `index.js` ✓ Already set up