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

The SDK is automatically initialized when the app starts in `app/_layout.tsx`:

- On **iOS/Android**: initialized via React Native SDK
- On **Web**: uses global `window.amplitude` object loaded via CDN

## Integration with Authentication

Amplitude is **automatically integrated** with the authentication system in `contexts/AuthContext.tsx`:

### On User Login:
- Automatically calls `setAmplitudeUserId(userId, email)`
- User ID and email are set immediately after successful authentication
- All subsequent events will be linked to this user

### On User Logout:
- Automatically calls `resetAmplitudeUser()`
- User ID is reset
- Session is cleared
- **Important**: This prevents "merging" of different users on the same device

### Scenario: 2 Users on the Same Device

```
User A logs in
  ↓
  setAmplitudeUserId("user-A-id")
  ↓
Events tracked as user-A ✅
  ↓
User A logs out
  ↓
  resetAmplitudeUser() → reset userId and session
  ↓
User B logs in
  ↓
  setAmplitudeUserId("user-B-id")
  ↓
Events tracked as user-B ✅
```

**Without reset()** data from different users could be mixed via device ID.  
**With reset()** each user is tracked separately.

## Files

- **Configuration**: `constants/amplitude.config.ts` (API key and server zone)
- **Service**: `services/amplitude.service.ts`
- **Web HTML**: `app/+html.tsx` (contains script tag for CDN)
- **Initialization**: `app/_layout.tsx`
- **Authentication**: `contexts/AuthContext.tsx` (automatic userId set/reset)

## Verification

1. Run the application
2. The console should display:
   - iOS/Android: `[Amplitude] Native SDK initialized successfully with Session Replay`
   - Web: `[Amplitude] Web SDK initialized successfully with Session Replay`
3. When events are sent, the console will show:
   - `[Amplitude] Event tracked (web/native): EventName {...}`

## Platforms

| Platform | SDK | Session Replay | Autocapture |
|----------|-----|----------------|-------------|
| iOS | React Native | ✅ | ❌ |
| Android | React Native | ✅ | ❌ |
| Web | Browser SDK | ✅ | ✅ |

Autocapture on Web automatically tracks clicks, forms, navigation, and other user interactions without manual code.

