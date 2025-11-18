# Firebase Messaging Modular API

## Problem with require()

When conditionally importing Firebase Messaging via `require()` in React Native, you may encounter:
```
TypeError: undefined is not a function
```

**Incorrect approach:**
```typescript
const messaging = require('@react-native-firebase/messaging').default;
await messaging().requestPermission(); // ❌ Error: undefined is not a function
```

## Solution: Modular API

Use the modular API from `/lib/modular` instead of the namespace API:

```typescript
// Import modular API
if (Platform.OS !== 'web') {
  const { getMessaging, requestPermission, getToken, onTokenRefresh, AuthorizationStatus } 
    = require('@react-native-firebase/messaging/lib/modular');
  
  // Usage
  const messaging = getMessaging();
  const authStatus = await requestPermission(messaging);
  const fcmToken = await getToken(messaging);
  
  // Check authorization status
  if (authStatus === AuthorizationStatus.AUTHORIZED) {
    // ...
  }
  
  // Subscribe to token refresh
  const unsubscribe = onTokenRefresh(messaging, (token) => {
    // ...
  });
}
```

## Examples in Project

- `services/notification.service.ts` - FCM notifications
- `services/remoteConfig.service.ts` - Remote Config (similar approach)

## Documentation

- [React Native Firebase Modular API](https://rnfirebase.io/messaging/usage)

