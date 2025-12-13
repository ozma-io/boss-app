# Tracking & Attribution Flow

This document describes the complete flow of Facebook attribution tracking and App Tracking Transparency (ATT) permission handling for iOS and Android platforms.

## Overview

The app implements a sophisticated attribution tracking system that:
- Captures Facebook attribution data from deep links on first launch
- Handles iOS App Tracking Transparency (ATT) permission requests
- Sends AppInstall events to Facebook with proper tracking consent flags
- Provides a custom UI onboarding screen before system permission prompts
- Supports re-prompting users after 2 weeks if permission was denied

## Table of Contents

1. [First Launch Flow (iOS with FB Attribution)](#first-launch-flow-ios-with-fb-attribution)
2. [First Launch Flow (Android with FB Attribution)](#first-launch-flow-android-with-fb-attribution)
3. [First Launch Flow (No FB Attribution)](#first-launch-flow-no-fb-attribution)
4. [Re-prompt Flow (After 2 Weeks)](#re-prompt-flow-after-2-weeks)
5. [Technical Implementation](#technical-implementation)
6. [Attribution Data Structure](#attribution-data-structure)

---

## First Launch Flow (iOS with FB Attribution)

### Prerequisites
- User installs app via Facebook ad
- App opens via deep link containing `fbclid` or `utm_source=facebook`

### Flow Steps

1. **App Initialization** (`app/_layout.tsx`)
   ```
   ✓ Initialize Facebook SDK
   ✓ Check if first launch
   ✓ Parse deep link URL for attribution parameters
   ✓ Save attribution data to AsyncStorage
   ✓ Log: "iOS: Attribution data saved, tracking onboarding will handle permission and events"
   ```

2. **Tracking Onboarding Check** (`contexts/TrackingOnboardingContext.tsx`)
   ```
   ✓ Check platform: iOS ✓
   ✓ Check if ATT permission already determined: NO
   ✓ Check for Facebook attribution: YES (fbclid or utm_source=facebook)
   ✓ Set shouldShowOnboarding = true
   ```

3. **Show Custom UI Screen** (`app/tracking-onboarding.tsx`)
   - Display friendly explanation of why tracking is needed
   - Show benefits:
     - Better recommendations for users who need the app
     - Support the app's growth
   - User sees "Continue" button

4. **User Taps Continue**
   ```
   ✓ Request iOS ATT system permission (native dialog)
   ✓ User makes choice: Grant or Deny
   ✓ Record permission status in Firestore (if user logged in)
   ✓ Check: Is this first launch? YES
   ```

5. **Send Facebook Events**
   - **Dual-send (client + server):**
     ```typescript
     sendAppInstallEventDual(userId, attributionData, userData)
     // Sends AppInstall event only (not AppLaunch)
     // - Client-side: via Facebook SDK (fb_mobile_activate_app)
     // - Server-side: via Cloud Function to Conversions API
     // - Uses shared eventId for deduplication
     // - advertiserTrackingEnabled: true/false (based on user choice)
     // - applicationTrackingEnabled: true
     // - extinfo: [16-element device info array]
     // - fbclid, userData, customData
     ```

6. **Navigate to App**
   - If authenticated: → `/(tabs)`
   - If unauthenticated: → `/(auth)/welcome`

### Result

✅ Facebook receives AppInstall event with accurate tracking consent
✅ `advertiserTrackingEnabled = true` if user granted permission
✅ `advertiserTrackingEnabled = false` if user denied permission
✅ User had clear understanding before granting/denying permission

---

## First Launch Flow (Android with FB Attribution)

### Prerequisites
- User installs app via Facebook ad
- App opens via deep link containing `fbclid` or `utm_source=facebook`

### Flow Steps

1. **App Initialization** (`app/_layout.tsx`)
   ```
   ✓ Initialize Facebook SDK
   ✓ Check if first launch
   ✓ Parse deep link URL for attribution parameters
   ✓ Save attribution data to AsyncStorage
   ✓ Detect platform: Android
   ✓ Check for Facebook attribution: YES
   ```

2. **Send Facebook Events Immediately**
   - No permission prompt needed (Android doesn't have ATT)
   
   - **Dual-send (client + server):**
     ```typescript
     sendAppInstallEventDual(userId, attributionData, userData)
     // Sends AppInstall event only (not AppLaunch)
     // - Client-side: via Facebook SDK (fb_mobile_activate_app)
     // - Server-side: via Cloud Function to Conversions API
     // - Uses shared eventId for deduplication
     // - advertiserTrackingEnabled: true (always on Android)
     // - applicationTrackingEnabled: true
     ```

3. **No Onboarding Screen**
   ```
   ✗ TrackingOnboardingContext detects Android platform
   ✗ shouldShowFirstLaunchTracking() returns false
   ✗ Tracking onboarding screen is NOT shown
   ```

4. **Continue Normal Flow**
   - App continues to welcome screen or tabs

### Result

✅ Facebook receives AppInstall event immediately
✅ `advertiserTrackingEnabled = true` (Android doesn't require ATT)
✅ No UI interruption for user

---

## First Launch Flow (No FB Attribution)

### For Both iOS and Android

1. **App Initialization**
   ```
   ✓ Initialize Facebook SDK
   ✓ Check if first launch
   ✓ Parse deep link URL
   ✓ No fbclid or utm_source=facebook found
   ✓ Save empty attribution data to AsyncStorage
   ```

2. **Skip Tracking Flow**
   ```
   ✗ hasFacebookAttribution() returns false
   ✗ No tracking onboarding shown
   ✗ No AppInstall events sent
   ✗ No ATT permission requested
   ```

3. **Log Output**
   ```
   [App] No Facebook attribution detected
   [TrackingOnboarding] First launch but no Facebook attribution, skipping tracking onboarding
   ```

### Result

✅ Normal app flow without any tracking-related interruptions
✅ No Facebook events sent (user didn't come from FB ad)

---

## Re-prompt Flow (After 2 Weeks)

### Prerequisites
- User is authenticated
- User previously denied tracking permission on iOS
- 14+ days have passed since last prompt

### Flow Steps

1. **App Returns to Foreground** or **User Logs In**
   ```
   ✓ TrackingOnboardingContext checks shouldShowTrackingOnboarding(userId)
   ✓ Platform: iOS
   ✓ Current system status: denied
   ✓ Days since last prompt: 14+
   ✓ Result: Show onboarding
   ```

2. **Show Custom UI Screen**
   - Same tracking onboarding screen as first launch
   - Explains benefits of tracking again

3. **User Taps Continue**
   ```
   ✓ Request iOS ATT system permission again
   ✓ User makes choice: Grant or Deny
   ✓ Update permission status in Firestore
   ✓ Check: Is this first launch? NO
   ```

4. **Skip AppInstall Events**
   ```
   ✗ firstLaunch = false
   ✗ No AppInstall events sent
   ✓ Only update tracking status in Firestore
   ```

5. **Navigate Back**
   - Returns to main app: `/(tabs)`

### Result

✅ User gets another chance to grant permission
✅ No duplicate AppInstall events sent
✅ Firestore has updated tracking status

---

## Technical Implementation

### Key Files

- **`app/_layout.tsx`**
  - Handles first launch detection
  - Parses attribution data from deep links
  - Sends events immediately on Android
  - Delegates to tracking onboarding on iOS

- **`contexts/TrackingOnboardingContext.tsx`**
  - Determines when to show tracking onboarding
  - Checks for first launch + Facebook attribution
  - Handles re-prompt logic for authenticated users
  - Syncs tracking status with Firestore

- **`app/tracking-onboarding.tsx`**
  - Custom UI screen with tracking explanation
  - Requests iOS ATT permission
  - Sends AppInstall events to Facebook (first launch only)
  - Updates Firestore with permission status

- **`services/facebook.service.ts`**
  - `parseDeepLinkParams()` - Extracts attribution from URL
  - `sendAppInstallEventDual()` - Dual-send AppInstall event (client + server, first launch only)
  - `sendAppLaunchEventDual()` - Dual-send AppLaunch event (client + server, subsequent launches)
  - `sendConversionEvent()` - Prepares all required fields for server-side events

- **`services/tracking.service.ts`**
  - `shouldShowFirstLaunchTracking()` - iOS first launch check
  - `shouldShowTrackingOnboarding()` - Re-prompt logic for authenticated users
  - `requestTrackingPermission()` - Wraps iOS ATT API
  - `hasFacebookAttribution()` - Checks for FB attribution data

- **`utils/deviceInfo.ts`**
  - `buildExtinfo()` - Creates 16-element device info array
  - `getAdvertiserTrackingEnabled()` - Gets ATT status
  - `getApplicationTrackingEnabledSync()` - App-level tracking flag

### Attribution Flow Diagram

```
Deep Link URL
     ↓
parseDeepLinkParams()
     ↓
Save to AsyncStorage
     ↓
     ├─→ iOS + FB Attribution
     │        ↓
     │   Show Tracking Onboarding UI
     │        ↓
     │   Request ATT Permission
     │        ↓
     │   Send Facebook Events
     │
     └─→ Android + FB Attribution
              ↓
         Send Facebook Events Immediately
```

---

## Attribution Data Structure

### Deep Link Format

```
https://discovery.ozma.io/go-app/the-boss?fbclid=xxx&utm_source=facebook&utm_medium=cpc&utm_campaign=install&email=user@example.com
```

### Parsed Attribution Data

```typescript
interface AttributionData {
  fbclid?: string | null;           // Facebook click ID
  utm_source?: string | null;       // e.g., "facebook"
  utm_medium?: string | null;       // e.g., "cpc"
  utm_campaign?: string | null;     // e.g., "install"
  utm_content?: string | null;      // Ad content
  utm_term?: string | null;         // Search term
  email?: string | null;            // Pre-fill email
  appUserId?: string | null;        // App user ID
  installedAt?: string;             // ISO 8601 timestamp
}
```

### Facebook Conversions API Payload

```typescript
{
  eventName: "AppInstall",
  eventTime: 1699632000,
  eventId: "unique-uuid",
  advertiserTrackingEnabled: true/false,  // Based on ATT
  applicationTrackingEnabled: true,
  extinfo: [/* 16 device info elements */],
  fbclid: "xxx",
  userData: {
    email: "hashed-email"
  },
  customData: {
    utm_source: "facebook",
    utm_medium: "cpc",
    utm_campaign: "install"
  }
}
```

---

## Testing

### Simulate First Launch with Attribution (iOS Simulator)

```bash
# Reset app (delete and reinstall)
# Then open with attribution data:
xcrun simctl openurl booted "exp+boss-app://expo-development-client/?url=http://localhost:8081&fbclid=test123&utm_source=facebook&email=test@example.com"
```

### Expected Logs (iOS with Attribution)

```
[App] First launch detected, checking for attribution data
[App] Initial URL detected: exp+boss-app://...
[Facebook] Parsed deep link params: {"fbclid": "test123", "utm_source": "facebook", ...}
[App] iOS: Attribution data saved, tracking onboarding will handle permission and events
[TrackingOnboarding] First launch with Facebook attribution detected, will show tracking onboarding
[App] Routing to: /tracking-onboarding
[TrackingOnboarding] ATT permission status: authorized/denied
[TrackingOnboarding] First launch detected, sending AppInstall events to Facebook
[Facebook] AppInstall event logged to Facebook
[Facebook] Sending conversion event to Cloud Function
[Facebook] Conversion event sent successfully
```

### Expected Logs (Android with Attribution)

```
[App] First launch detected, checking for attribution data
[App] Initial URL detected: ...
[Facebook] Parsed deep link params: {"fbclid": "test123", ...}
[App] Android: Sending AppInstall events immediately
[Facebook] AppInstall event logged to Facebook
[Facebook] Conversion event sent successfully
[App] Android: AppInstall events sent successfully
[TrackingOnboarding] Not iOS platform, no need to show first launch tracking
```

### Expected Logs (No Attribution)

```
[App] First launch detected, checking for attribution data
[App] Initial URL detected: ...
[Facebook] Parsed deep link params: {"appUserId": null, "email": null, ...}
[App] No Facebook attribution detected
[TrackingOnboarding] First launch but no Facebook attribution, skipping tracking onboarding
```

---

## Privacy Compliance

### iOS Requirements

✅ **ATT Compliance**
- Custom explanation screen shown before system prompt
- User explicitly grants/denies permission
- Permission status accurately reported to Facebook
- Re-prompting allowed after 14 days

✅ **App Store Guidelines**
- No tracking before permission granted
- Clear explanation of tracking purpose
- User can deny without app functionality loss

### Facebook Requirements

✅ **Conversions API Compliance**
- `advertiserTrackingEnabled` accurately reflects ATT status
- `applicationTrackingEnabled` indicates app supports tracking
- Device info provided via `extinfo` array
- Event deduplication via `eventId`

### GDPR/CCPA Considerations

- Attribution data stored in user's Firestore document
- Can be deleted when user account is deleted
- Tracking status stored and honored
- No tracking for users without Facebook attribution

---

## Troubleshooting

### Events Not Sending

**Check:**
1. Is there Facebook attribution data? (`hasFacebookAttribution()`)
2. Is `FACEBOOK_PIXEL_ID` configured?
3. Is Cloud Function `sendFacebookConversionEvent` deployed?
4. Are all required fields present in payload?

### Tracking Onboarding Not Showing (iOS)

**Check:**
1. Is this first launch? (`isFirstLaunch()`)
2. Is there Facebook attribution? (`hasFacebookAttribution()`)
3. Has ATT permission already been determined?
4. Check logs for `[TrackingOnboarding]` messages

### Android Events Not Sending

**Check:**
1. Is Facebook SDK initialized?
2. Is attribution data present?
3. Check `_layout.tsx` Android-specific flow
4. Verify logs show "Android: Sending AppInstall events immediately"

---

## Related Documentation

- [Facebook Integration](./facebook-integration.md) - Complete Facebook SDK setup
- [Firebase Cloud Functions](./firebase-deployment.md) - Cloud Function deployment
- [Attribution Service](./attribution-service.md) - Attribution data management

---

**Last Updated:** 2025-11-10
**Version:** 1.0

