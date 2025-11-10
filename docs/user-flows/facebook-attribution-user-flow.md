# Facebook Attribution User Flow

This document describes the screen-by-screen user experience when a user installs the app from a Facebook ad.

## Deep Link Format

```
https://discovery.ozma.io/go-app/the-boss?fbclid=xxx&utm_source=facebook&utm_medium=cpc&utm_campaign=install&email=user@example.com
```

## Flow Decision Tree

```
User installs app
     |
     ├─ Has email in deep link?
     |  |
     |  ├─ YES + iOS + Facebook attribution
     |  |  └─> Tracking Onboarding → Email Input (pre-filled)
     |  |
     |  ├─ YES + Android (or no Facebook)
     |  |  └─> Email Input (pre-filled) immediately
     |  |
     |  └─ NO
     |     └─> Welcome → Email Input (empty)
     |
     └─ All flows converge at Email Confirmation → Main App
```

---

## iOS User Flow

### Screen 1: Tracking Onboarding

**What happens:**
- App initializes, detects first launch with Facebook attribution
- Parses deep link parameters (`fbclid`, `utm_source`, `email`, etc.)
- Shows tracking permission education screen

**What user sees:**
- 🎯 Target icon
- **Title:** "Help us improve your experience"
- **Description:** Request to send installation data to Meta
- **Benefits:**
  - ✅ Better recommendations for users who need the app
  - ✅ Support the app's growth
- **Button:** "Continue"

**User action:** Taps "Continue"

**What happens:**
- iOS system ATT (App Tracking Transparency) dialog appears
- User grants or denies tracking permission
- AppInstall events sent to Facebook with correct tracking consent flags
- Attribution data saved to AsyncStorage

**Status:** ✅ **Ready** (Screen implemented, Facebook App ID & Client Token configured)

**Next:** → Welcome Screen

---

### Screen 2: Welcome (Conditional)

**When shown:**
- ❌ **SKIPPED** if user has email in deep link
- ✅ Shown only if no email in attribution data

**What user sees:**
- 🎭 Emoji faces image
- **Title:** "Microsteps as a Path to Growth"
- **Subtitle:** "Your AI Assistant tells you exactly what to do next"
- **Sign-in options:**
  - 📧 Continue with Email
  - 🔴 Continue with Google
  - 🍎 Continue with Apple
- **Footer:** Privacy policy | Terms of service (links to Iubenda)

**User action:** Taps "Continue with Email"

**TODO:**
- Configure Apple Sign-In in Firebase Console when Apple Developer account is ready (requires Services ID, Team ID, Private Key, Key ID)
- Add SHA-1 fingerprints (debug + production release signing key) to Firebase for Android Google Sign-In

**Next:** 
- If email in attribution → **SKIP** to Email Input Screen (pre-filled)
- Otherwise → Email Input Screen (empty)

---

### Screen 3: Email Input

**When shown:**
- Always after Tracking Onboarding (iOS + Facebook) OR directly after app launch (Android/no Facebook)
- **Aggressively pre-filled** if email was in deep link

**What user sees:**
- **Title:** "What's your Email?"
- **Subtitle:** "We will send you a four-digit code to this email"
- **Email input field** (automatically pre-filled if `email` was in deep link)
- **Button:** "Continue" (enabled when email is valid)

**User action:** 
- If email pre-filled: just taps "Continue"
- If empty: enters email and taps "Continue"

**What happens:**
- Magic link sent to email
- Email saved to localStorage (web) or passed as parameter

**Next:** → Email Confirmation Screen (code input)

---

## Android User Flow

### Direct to Email Input (if email in deep link)

**Difference from iOS:**
- ❌ Tracking Onboarding screen is NOT shown
- ❌ Welcome screen is SKIPPED if email present
- ✅ AppInstall events sent immediately on app initialization (no ATT required)
- ✅ User goes **directly to Email Input** screen with pre-filled email

**What happens behind the scenes:**
- Deep link parameters parsed
- Attribution data saved
- Facebook events sent automatically with `advertiserTrackingEnabled: true`
- Email extracted and passed to Email Input screen

**Flow:**
- With email: App Launch → Email Input (pre-filled) → Email Confirm → Main App
- Without email: App Launch → Welcome → Email Input → Email Confirm → Main App

---

## No Attribution Flow

**When:** User installs app without Facebook ad (direct install, organic, etc.)

**What happens:**
- ❌ No `fbclid` or `utm_source=facebook` in deep link
- ❌ Tracking Onboarding NOT shown (even on iOS)
- ❌ No Facebook events sent
- ✅ User goes directly to Welcome screen

**Flow:** Welcome → Email Input → etc.

---

## Attribution Data Lifecycle

### 1. First Launch
```
Deep Link → Parse Params → Save to AsyncStorage
```

### 2. During Onboarding
```
AsyncStorage → Read for Events → Send to Facebook
```

### 3. After Authentication
```
AsyncStorage → Link to User Profile in Firestore → Clear AsyncStorage
```

### 4. User Profile
```
Firestore user document now contains:
- attribution.fbclid
- attribution.utm_source
- attribution.utm_campaign
- attribution.installedAt
```

---

## Key Technical Points

### iOS ATT Handling
- Custom UI shown before system prompt (App Store requirement)
- Permission status sent to Facebook: `advertiserTrackingEnabled: true/false`
- Can re-prompt after 14 days if user denied

### Android
- No permission prompt needed
- Events sent immediately on first launch
- Always `advertiserTrackingEnabled: true`

### Email Pre-fill
- If deep link contains `email` parameter, it's automatically filled in Email Input screen
- Stored in attribution data and linked to user profile after authentication

### Event Deduplication
- AppInstall events sent only once (on first launch)
- Unique `eventId` generated to prevent duplicates
- Server-side + Client-side events for redundancy

---

## Example Attribution Data

```typescript
{
  fbclid: "IwAR1234...",
  utm_source: "facebook",
  utm_medium: "cpc",
  utm_campaign: "install_campaign_q4",
  utm_content: "ad_creative_1",
  email: "user@example.com",
  installedAt: "2025-11-10T12:34:56.789Z"
}
```

---

## Related Documentation

- [Tracking & Attribution Flow](./tracking-and-attribution-flow.md) - Technical implementation details
- [Facebook Integration](./facebook-integration.md) - Facebook SDK setup
- [Authentication](./authentication.md) - Auth flow details

---

**Last Updated:** 2025-11-10

