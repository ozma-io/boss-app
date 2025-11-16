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
     |  |  └─> Tracking Onboarding → Email Input (pre-filled) → Email Confirmation → Main App
     |  |
     |  ├─ YES + Android (or no Facebook)
     |  |  └─> Email Input (pre-filled) → Email Confirmation → Main App
     |  |
     |  └─ NO
     |     └─> Welcome → Email Input (empty) → Email Confirmation → Main App
     |
     └─ All flows converge at Main App (authenticated)
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

**Completed:**
- ✅ App logo/icon ready (all required sizes: 1024×1024)

**TODO:**
- After app publication, configure Facebook settings with platform-specific IDs (required for attribution tracking)
- See credentials in `../temp/facebook-app-credentials.md`

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

**Completed:**
- ✅ Apple Sign-In configured in Firebase Console (Services ID, Team ID, Private Key, Key ID)
- ✅ SHA-1 fingerprints added to Firebase for Android Google Sign-In (debug + production)

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
- **Subtitle:** "We'll email you a link to sign in. No password needed."
- **Email input field** (automatically pre-filled if `email` was in deep link)
- **Button:** "Continue" (enabled when email is valid)

**User action:** 
- If email pre-filled: just taps "Continue"
- If empty: enters email and taps "Continue"

**What happens:**
- Magic link sent to email
- Email saved to localStorage (web) or passed as parameter

**Next:** → Email Confirmation Screen (waiting for magic link)

---

### Screen 4: Email Confirmation

**What user sees:**
- ✉️ Mail icon in a circular container
- **Title:** "Check your email"
- **Message:** "We sent a magic link to [user@example.com]"
- **Instructions:** "Click the link in the email to sign in. The link will expire in 1 hour."
- **Resend link button** (with 60-second countdown timer)
- **"Paste link manually" button** (mobile only, for development/testing)

**User action:**
1. Opens email app
2. Finds email from Firebase (or custom domain)
3. Clicks the magic link in email

**What happens behind the scenes:**
- App listens for deep link events (`Linking.addEventListener`)
- When magic link clicked, app receives deep link with Firebase auth token
- `verifyEmailCode(email, emailLink)` validates the link
- User authenticated and profile created/updated in Firestore
- Attribution data (if exists) linked to user profile
- AsyncStorage attribution data cleared

**Mobile-specific behavior:**
- On iOS/Android: Magic link opens the app directly via deep linking
- If app is closed: Opens app → Email Confirmation screen → auto-verifies
- Development mode: "Paste link manually" allows testing without email client

**Status:** ✅ **Ready** (Implemented in `app/(auth)/email-confirm.tsx` and `EmailAuthModal.tsx`)

**Next:** → Main App (Profile Screen)

---

### Screen 5: Main App (Profile Screen)

**What happens:**
- User is fully authenticated
- Attribution data (if any) permanently linked to user profile in Firestore
- User profile created/updated with email and metadata
- App navigates to `/(tabs)` route, which opens Profile tab by default

**What user sees:**
- **Header:** "BossUp" title centered at top
- **Profile Section:**
  - Avatar image (120x120px, rounded)
  - Username (mock data: "Mike_reex")
  - User's email address
- **Goal Card** (green background `#B8E986`):
  - 🚩 Flag icon + "Your Goal:" label
  - ✏️ Edit button (right side)
  - Goal description text (editable on tap)
- **Position Card** (white background):
  - 💼 Briefcase icon + "Position:" label
  - ✏️ Edit button (right side)
  - Position text (editable on tap, mock data: "Senior Developer")
- **Department Card** (white background):
  - 🏢 Department icon + "Department:" label
  - ✏️ Edit button (right side)
  - Department text (editable on tap, mock data: "Engineering")
- **"Where You Now" Metrics Section:**
  - **Your stress level** - Progress bar with percentage
  - **Boss relationship challenges** - Progress bar with percentage (red)
  - **Self-doubt / confidence gap** - Progress bar with percentage
- **Settings Section:**
  - Personal information →
  - Subscription →
  - Support →
- **Floating Chat Button** (bottom-right):
  - Green circular button with chat icon
  - Always visible, opens AI assistant chat

**User actions available:**
- Edit goal description
- Open chat with AI assistant
- Navigate to settings pages
- View metrics (currently mock data)

**Background color:** Warm beige `#F5F1E8`

**Status:** ✅ **Ready** (Implemented in `app/(tabs)/profile.tsx`)

**Technical notes:**
- Uses mock data for profile, goal, and metrics
- Amplitude event: `profile_screen_viewed` tracked on focus
- Chat button navigates to `/chat` route
- Settings items navigate to respective screens

**Next:** User can start chatting with AI assistant or explore settings

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

**Flow:** Welcome → Email Input → Email Confirm → Main App

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

## TODO: Internal Testing Release

**Goal:** Enable internal testers to test the app on their devices (iOS TestFlight + Android Internal Testing) without submitting to App Store/Google Play review.

**Status:** 🔄 In Progress

---

**Last Updated:** 2025-11-10

