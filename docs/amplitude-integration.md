# Amplitude Analytics Integration

## Overview

Amplitude SDK with Session Replay is integrated for all platforms:
- **iOS/Android**: uses `@amplitude/analytics-react-native`
- **Web**: uses Browser SDK via CDN

All events and methods work identically across all platforms through a unified API.

## Configuration

Configuration is centralized in `constants/amplitude.config.ts`:
- **API Key**: configured in `AMPLITUDE_API_KEY`
- **Server Zone**: US (default, no parameter needed)
- **Session Replay**: enabled on all platforms
- **Sample Rate**: 100% (all sessions are recorded)

### Native (iOS/Android) Session Replay Setup

Session Replay is enabled via `sessionReplayTracking` configuration during Amplitude initialization:

```typescript
await amplitude.init(AMPLITUDE_API_KEY, undefined, {
  disableCookies: true,
  defaultTracking: true,
  sessionReplayTracking: {
    sampleRate: 1, // Record 100% of sessions
  },
});
```

This approach ensures proper `sessionId` handling by the Session Replay plugin.

### Web Session Replay Setup

For web platform, Session Replay requires:
1. Main Amplitude Browser SDK script (`script/[API_KEY].js`)
2. Session Replay plugin script (`plugin-session-replay-browser-1-latest.umd.js`)

Both scripts are loaded via CDN in `app/+html.tsx` and the plugin is initialized automatically during SDK setup.

### Web Additional Features
- **Autocapture**: enabled for all event types
  - Attribution
  - File Downloads
  - Form Interactions
  - Page Views
  - Sessions
  - Element Interactions
  - Network Tracking
  - Web Vitals
  - Frustration Interactions

## Usage

### Tracking Events

```typescript
import { trackAmplitudeEvent } from '@/services/amplitude.service';

// Simple event
trackAmplitudeEvent("Button Clicked");

// Event with properties
trackAmplitudeEvent("Button Clicked", { 
  buttonColor: 'primary',
  screenName: 'Home',
  userId: '12345'
});
```

### Setting User ID and Email

```typescript
import { setAmplitudeUserId } from '@/services/amplitude.service';

// After user authentication
await setAmplitudeUserId(userId, userEmail);

// Note: if email is an empty string, '[no_email]' will be set in Amplitude
// (this can happen during OAuth authentication when the user hides their email)
// This allows tracking users without email in analytics
```

### Resetting User

```typescript
import { resetAmplitudeUser } from '@/services/amplitude.service';

// On user logout
await resetAmplitudeUser();
```

## Initialization

The SDK initialization timing differs by platform:

- On **iOS/Android**: initialized at app startup in `app/_layout.tsx` via React Native SDK
- On **Web**: initialized AFTER authentication in `contexts/AuthContext.tsx` using global `window.amplitude` object loaded via CDN

This approach ensures that web analytics are only active for authenticated users, improving privacy and reducing unnecessary tracking.

### Event Queue Before Initialization

The service includes automatic event queuing to prevent data loss during app startup:

- **Before SDK initialization**: all tracked events, user ID settings, and user properties are queued in memory
- **After SDK initialization**: the queue is automatically flushed and all queued items are sent to Amplitude
- **Works on all platforms**: iOS, Android, and Web

This ensures that events triggered during app startup (e.g., `welcome_screen_viewed`) are not lost, even if they are tracked before the SDK finishes initializing.

**Console output example:**
```
[Amplitude] SDK not initialized, queuing event: welcome_screen_viewed
[Amplitude] Initializing Web SDK with Session Replay...
[Amplitude] Web SDK initialized successfully with Session Replay
[Amplitude] Flushing 1 queued items...
[Amplitude] Event tracked (web): welcome_screen_viewed
[Amplitude] Queue flushed successfully
```

**What gets queued:**
- `trackAmplitudeEvent()` calls
- `setAmplitudeUserId()` calls
- `setAmplitudeUserProperties()` calls

**Note:** You don't need to check if the SDK is initialized before tracking events - the service handles this automatically.

## Integration with Authentication

Amplitude is **automatically integrated** with the authentication system in `contexts/AuthContext.tsx`:

### On User Login:
- **Web**: Amplitude SDK is initialized first, then `setAmplitudeUserId(userId)` is called
- **iOS/Android**: SDK already initialized at startup, only `setAmplitudeUserId(userId)` is called
- User ID is set immediately after successful authentication
- All subsequent events will be linked to this user

### On User Logout:
- Automatically calls `resetAmplitudeUser()`
- User ID is reset
- Session is cleared
- **Web**: SDK initialization flag is also reset, allowing re-initialization on next login
- **iOS/Android**: SDK remains initialized (reset is sufficient for proper session handling)
- **Important**: This prevents "merging" of different users on the same device

### Scenario: 2 Users on the Same Device

**Web Platform:**
```
User A logs in
  ↓
  initializeAmplitude() + setAmplitudeUserId("user-A-id")
  ↓
Events tracked as user-A ✅
  ↓
User A logs out
  ↓
  resetAmplitudeUser() → reset userId, session, and initialization flag
  ↓
User B logs in
  ↓
  initializeAmplitude() + setAmplitudeUserId("user-B-id") → fresh SDK initialization
  ↓
Events tracked as user-B ✅
```

**iOS/Android Platform:**
```
App starts → initializeAmplitude() once
  ↓
User A logs in
  ↓
  setAmplitudeUserId("user-A-id")
  ↓
Events tracked as user-A ✅
  ↓
User A logs out
  ↓
  resetAmplitudeUser() → reset userId and session (SDK stays initialized)
  ↓
User B logs in
  ↓
  setAmplitudeUserId("user-B-id")
  ↓
Events tracked as user-B ✅
```

**Without reset()** data from different users could be mixed via device ID.  
**With reset()** each user is tracked separately with proper session isolation.

## Files

- **Configuration**: `constants/amplitude.config.ts` (API key and server zone)
- **Service**: `services/amplitude.service.ts`
- **Web HTML**: `app/+html.tsx` (contains script tag for CDN)
- **Initialization**: `app/_layout.tsx`
- **Authentication**: `contexts/AuthContext.tsx` (automatic userId set/reset)

## Verification

1. Run the application
2. The console should display:
   - **iOS/Android** (on app start): `[Amplitude] Native SDK initialized successfully with Session Replay`
   - **Web** (after authentication): `[Amplitude] Web SDK initialized successfully with Session Replay`
3. When events are sent, the console will show:
   - `[Amplitude] Event tracked (web/native): EventName {...}`
   
**Important**: On web platform, Amplitude initialization happens AFTER user authentication. Any events tracked before authentication will be queued and sent once the SDK is initialized.

## Platforms

| Platform | SDK | Session Replay | Autocapture |
|----------|-----|----------------|-------------|
| iOS | React Native | ✅ | ❌ |
| Android | React Native | ✅ | ❌ |
| Web | Browser SDK | ✅ | ✅ |

Autocapture on Web automatically tracks clicks, forms, navigation, and other user interactions without manual code.

