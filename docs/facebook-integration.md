# Facebook Attribution & Conversions API

Complete guide for Facebook Attribution tracking and Conversions API integration.

---

## 🔗 Quick Links

- **Facebook App Dashboard:** https://developers.facebook.com/apps/853405190716887/dashboard/?business_id=2178506568838763
- **Facebook Events Manager:** https://business.facebook.com/events_manager
- **Google Play Console:** https://play.google.com/console/

---

## 📋 Overview

The app integrates with Facebook for:
- **Automatic Event Logging** - SDK automatically tracks standard events (app launches, purchases, content views)
- **Attribution tracking** - Track app installs from Meta ads with deep links (manual events for attribution data)
- **Conversions API** - Server-side event tracking (fb_mobile_activate_app, fb_mobile_purchase, etc.)
- **Email pre-filling** - Auto-fill email from attribution data

## 🔄 Event Tracking Strategy

The app uses a **hybrid approach** for Facebook event tracking:

### Automatic Events (autoLogAppEvents: true)
- ✅ **App launches** - Handled automatically by Facebook SDK
- ✅ **Purchases** - Automatic tracking of in-app purchases 
- ✅ **Content views** - Screen navigation and content engagement
- ✅ **Standard user actions** - Buttons, forms, and interactions

### Manual Events (attribution tracking only)
- 🎯 **Install events WITH attribution data** - For paid acquisition campaigns
- 🎯 **Events with fbclid/UTM parameters** - For proper campaign attribution
- 🎯 **Server-side events** - Via Conversions API for reliability

**When to use manual events:**
- User came from Facebook ad (has fbclid parameter)
- UTM parameters need to be preserved for campaign tracking
- Server-side reliability is required (bypasses ad blockers)

---

## 🔑 Getting Facebook Credentials

### 1. Facebook App ID & Client Token

**Purpose:** Public identifiers for Facebook SDK (hardcoded in code)

**Steps:**
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or use existing one
3. Navigate to **Settings → Basic**
4. Copy **App ID** and **Client Token**

**Where to add:**
- `constants/facebook.config.ts` (main source)
- `app.config.ts` (Expo config - must be kept in sync)

**Auto Event Logging:**
- `autoLogAppEvents: true` - Automatically tracks standard Facebook events (app launches, content views, purchases)
- Reduces manual event tracking and improves data consistency

```typescript
// constants/facebook.config.ts
export const FACEBOOK_APP_ID = 'YOUR_FACEBOOK_APP_ID';
export const FACEBOOK_CLIENT_TOKEN = 'YOUR_CLIENT_TOKEN';
```

### 2. Facebook Pixel ID

**Purpose:** Identifier for Conversions API events (hardcoded in code)

**Steps:**
1. Go to [Facebook Events Manager](https://business.facebook.com/events_manager)
2. Create a new pixel or use existing one
3. Copy the **Pixel ID**

**Where to add:**
- `constants/facebook.config.ts` (automatically imported by Cloud Functions)

```typescript
export const FACEBOOK_PIXEL_ID = 'YOUR_PIXEL_ID';
```

### 3. Facebook Access Token (Secret)

**Purpose:** Server-side API authentication for Conversions API

**Steps:**

**Option A: Via Events Manager (Recommended)**
1. Go to [Facebook Events Manager](https://business.facebook.com/events_manager)
2. Select your Pixel → **Settings → Conversions API**
3. Click **"Generate Access Token"**
4. Copy the token (starts with `EAA...`)

**Option B: Via System User**
1. Go to [Business Settings](https://business.facebook.com/settings)
2. **Users → System Users → Add**
3. Assign permissions: "Manage Ads" for your ad account
4. **Generate New Token** → select permissions: `ads_management`, `business_management`
5. Copy the token

**Where to add:**
See [Firebase Deployment Guide](./firebase-deployment.md#local-development-setup) for setting up secrets.

---

## 📱 Mobile Deep Links Setup

### iOS - Universal Links

Create `/.well-known/apple-app-site-association` on `discovery.ozma.io`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.ozmaio.bossup",
        "paths": ["/go-app/*"]
      }
    ]
  }
}
```

Replace `TEAM_ID` with your Apple Developer Team ID.

**After configuration:**
```bash
npx expo prebuild --platform ios
npx expo run:ios
```

### Android - App Links

Create `/.well-known/assetlinks.json` on `discovery.ozma.io`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.ozmaio.bossup",
      "sha256_cert_fingerprints": [
        "YOUR_SHA256_FINGERPRINT"
      ]
    }
  }
]
```

**Get SHA256 fingerprint:**
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**After configuration:**
```bash
npx expo prebuild --platform android
npx expo run:android
```

---

## 💾 Attribution Data Structure

Attribution data is stored in Firestore at `/users/{userId}/attribution`:

```typescript
{
  fbclid: string | null,           // Facebook click ID
  utm_source: string | null,       // e.g. "facebook"
  utm_medium: string | null,       // e.g. "cpc"
  utm_campaign: string | null,     // Campaign name
  utm_content: string | null,      // Ad content
  utm_term: string | null,         // Keywords
  email: string | null,            // Email from URL (for pre-fill)
  appUserId: string | null,        // User ID after auth
  installedAt: string              // ISO 8601 timestamp
}
```

---

## 🔧 Usage Examples

### Send Install Event with Attribution Data (Paid Acquisition Only)

Manual install events are **only needed** when you have attribution data from Facebook ads:

```typescript
import { isFirstLaunch, markAppAsLaunched, getAttributionData } from '@/services/attribution.service';
import { sendAppInstallEventDual } from '@/services/facebook.service';

async function handleAttributedInstall() {
  const firstLaunch = await isFirstLaunch();
  
  if (firstLaunch) {
    const attributionData = await getAttributionData();
    
    // ✅ ONLY send manual events if we have Facebook attribution data
    if (attributionData?.fbclid || attributionData?.utm_source === 'facebook') {
      // Send install event with attribution for proper campaign tracking
      await sendAppInstallEventDual(
        user?.id, // Firebase UID for external_id (may be undefined for pre-login)
        attributionData, // Contains fbclid, utm_source, utm_campaign, etc.
        attributionData.email ? { email: attributionData.email } : undefined
      );
    }
    // ❌ For organic users, SDK handles automatically - no manual event needed
    
    await markAppAsLaunched();
  }
}
```

**Key Points:**
- Manual events only for **paid acquisition** (fbclid present)
- **Organic installs** are handled automatically by SDK
- Attribution data (fbclid, UTM params) is critical for campaign optimization

### App Launch Events (Automatic)

App launch events are now handled **automatically** by Facebook SDK when `autoLogAppEvents: true`:

```typescript
// ❌ NO LONGER NEEDED - SDK handles automatically
// await sendAppLaunchEventDual(attributionData, userData);

// ✅ SDK automatically sends fb_mobile_activate_app on each app launch
// No manual code required - attribution happens through device fingerprinting
```

**Note:** Automatic app launch events use device fingerprinting and advertiser IDs for attribution. Manual events are only needed when you have Facebook attribution data (fbclid, UTM parameters) from paid acquisition campaigns.

### Send Custom Events

```typescript
import { sendConversionEvent } from '@/services/facebook.service';
import { getAttributionData } from '@/services/attribution.service';

// Purchase event (standard Facebook event)
async function handlePurchase(amount: number, currency: string) {
  const attributionData = await getAttributionData();
  
  await sendConversionEvent(
    'fb_mobile_purchase', // Standard Facebook event name
    {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    {
      value: amount,
      currency: currency,
    },
    attributionData || undefined
  );
}

// Complete Registration event (standard Facebook event)
async function handleRegistrationComplete() {
  const attributionData = await getAttributionData();
  
  await sendConversionEvent(
    'fb_mobile_complete_registration', // Standard Facebook event name
    { email: user.email },
    { registration_method: 'email' },
    attributionData || undefined
  );
}
```

---

## 🧪 Testing

### Test Flow

1. **User clicks Meta ad** → `https://discovery.ozma.io/go-app/the-boss?fbclid=xxx&utm_source=facebook&email=user@example.com`
2. **Redirect page** → directs to App Store/Play Store with params
3. **User installs and opens app** → Universal/App Links open app with URL
4. **App extracts data** → saves to AsyncStorage, sends `AppInstall` event
5. **Email pre-fill** → if email present, pre-fills email input
6. **After auth** → attribution linked to user document in Firestore

### Simulate Without Real Ads

```bash
# iOS Simulator
xcrun simctl openurl booted "https://discovery.ozma.io/go-app/the-boss?fbclid=test123&utm_source=facebook&email=test@example.com"

# Android
adb shell am start -W -a android.intent.action.VIEW -d "https://discovery.ozma.io/go-app/the-boss?fbclid=test123&utm_source=facebook&email=test@example.com" com.ozmaio.bossup
```

### Verify Events in Facebook

1. Go to [Facebook Events Manager](https://business.facebook.com/events_manager)
2. Select your pixel
3. Check **Test Events** tab
4. Look for `AppInstall` and other events
5. Verify event details and attribution data

---

## 🐛 Troubleshooting

### Events Not Appearing in Facebook

**Check:**
1. Expo Dev Tools logs (look for `[Facebook]` prefix)
2. Firebase Functions logs: `firebase functions:log`
3. Verify `FACEBOOK_ACCESS_TOKEN` is set correctly (see [Firebase Deployment](./firebase-deployment.md))
4. Verify Pixel ID in `constants/facebook.config.ts`

### "Invalid extinfo" Error

**Requirements:**
- `extinfo` array must have exactly 16 elements
- Element [0] (platform): "i2" (iOS) or "a2" (Android)
- Element [4] (OS version): Cannot be empty

### Deep Links Not Working

**iOS:**
- Verify Universal Links configuration on `discovery.ozma.io`
- Check Apple Developer Team ID is correct
- Ensure app is installed from scratch (not just updated)

**Android:**
- Verify App Links configuration on `discovery.ozma.io`
- Check SHA256 fingerprint matches your keystore
- Test with `adb shell` command

---

## 📊 Monitoring

### App Logs

Look for these prefixes in console:
- `[App]` - Root app initialization
- `[Attribution]` - Attribution service operations
- `[Facebook]` - Facebook SDK events
- `[AuthContext]` - Attribution linking to user

### Cloud Function Logs

```bash
firebase functions:log
```

Filter for `sendFacebookConversionEvent` function.

---

## 🔗 Related Documentation

- **Firebase deployment:** [firebase-deployment.md](./firebase-deployment.md)
- **Authentication flow:** [authentication.md](./authentication.md)
- **Firestore schemas:** See `firestore/schemas/user.schema.ts`

---

## 📝 Implementation Files

**Client-side:**
- `constants/facebook.config.ts` - Configuration constants
- `services/attribution.service.ts` - Attribution data management
- `services/facebook.service.ts` - Client-side Facebook SDK
- `app/_layout.tsx` - Deep link handling & SDK initialization
- `contexts/AuthContext.tsx` - Attribution linking after auth

**Server-side:**
- `functions/src/facebook.ts` - Conversions API Cloud Function
- `functions/src/constants.ts` - Re-exports from client config

**Data:**
- `firestore/schemas/user.schema.ts` - User schema with attribution fields

---

## ⚙️ Configuration Files

### Source of Truth

**Public constants (hardcoded):**
- `constants/facebook.config.ts` - Main source
- `app.config.ts` - Expo config (keep in sync)

**Secrets (Firebase Secret Manager):**
- See [Firebase Deployment Guide](./firebase-deployment.md)

### Updating Constants

When updating Facebook App ID, Client Token, or Pixel ID:
1. Update `constants/facebook.config.ts`
2. Update `app.config.ts` (App ID and Client Token only)
3. Rebuild app: `npx expo prebuild`

---

## 📊 Facebook Events Manager Setup

Configure Events Manager for proper iOS/Android attribution tracking.

### Prerequisites

- Facebook App created with App ID and Client Token
- iOS/Android platforms added to Facebook App Settings

### Step 1: Add Mobile Platforms

Go to [Facebook App Settings - Basic](https://developers.facebook.com/apps/853405190716887/settings/basic/)

#### iOS Platform

1. Click **"Add Platform"** → Select **"iOS"**
2. Configure:
   - **Bundle ID**: `com.ozmaio.bossup`
   - **iPhone Store ID**: Your App Store ID (after publication)
   - **iPad Store ID**: (optional)
   - **Shared Secret**: Get from App Store Connect → App Information → App-Specific Shared Secret
   - **SKAdNetwork**: ✅ Enable (critical for iOS 14.5+ attribution)
3. Enable **"Log in-app events automatically"**
4. Click **"Save Changes"**

#### Android Platform

1. Click **"Add Platform"** → Select **"Android"** or use **"Quick Start"**
2. Configure:
   - **Package Name**: `com.ozmaio.bossup`
   - **Class Name**: `com.ozmaio.bossup.MainActivity` (optional)
   - **Key Hashes**: SHA-1 fingerprints for Google Sign-In (hidden after save - this is normal)
3. Enable **"Log In-App Purchases Automatically"**
4. Enable **"Log In-App Subscriptions Automatically"**
5. Click **"Save Changes"**

**Note:** Key Hashes are hidden after saving for security - this is expected behavior.

---

### Step 2: Configure SKAdNetwork Events

Go to [Events Manager - Settings](https://business.facebook.com/events_manager2/list/dataset/1170898585142562/settings?business_id=2178506568838763)

1. Navigate to **"Settings"** tab → **"Apple's SKAdNetwork"** section
2. Click **"Configure events"**
3. Select **"Use Facebook SDK to manage SKAdNetwork"**
4. Click **"Next"**

#### Add Conversion Values

Configure event priorities for iOS 14.5+ attribution:

| Priority | Event Name | Value Optimization | Purpose |
|----------|-----------|-------------------|---------|
| **High** | `Subscribe` | Default | Subscription purchases (most important) |
| **Low** | `Activate app` | Default | App opens (baseline activity) |

**Future events to add** (when they appear after first users):
- **`fb_mobile_purchase`** (priority 63) - Direct revenue events
- **`Complete Registration`** (priority 50) - User registrations

**How to add more events:**
1. Click **"Edit events"** in Events Manager Settings
2. Select event from dropdown (events appear after app starts sending them)
3. Set priority (High/Medium/Low)
4. Save

**Note:** SKAdNetwork reports only the highest-priority event in the 24h conversion window.

---

### Step 3: Optional - Configure Advanced Measurement

#### Aggregated Event Measurement (AEM)

In Events Manager Settings → **"Meta's attribution for iOS 14+"**:
1. Click **"Continue"**
2. Verify deep link (should show "Completed")
3. Provides near-real-time reporting for iOS 14+ campaigns

#### Marketing Messages Events

Skip this - only needed for e-commerce apps with retargeting campaigns.

---

### Step 4: Verify Configuration

**Check these pages:**

1. **Facebook App Dashboard**: https://developers.facebook.com/apps/853405190716887/settings/basic/
   - ✅ iOS platform with Bundle ID and SKAdNetwork enabled
   - ✅ Android platform with Package Name

2. **Events Manager**: https://business.facebook.com/events_manager
   - ✅ SKAdNetwork events configured (Subscribe + Activate app)
   - ✅ No critical errors in Diagnostics tab

3. **Test Events** (after launching ads):
   - Install app from Facebook ad
   - Check **Test Events** tab for real-time data
   - Verify `AppInstall`, `Subscribe`, `Activate app` events appear

---

### Configuration Status

**Completed (2025-11-29):**
- ✅ iOS platform configured (Bundle ID + App Store ID + Shared Secret + SKAdNetwork)
- ✅ Android platform configured (Package Name + Class Name + Key Hashes)
- ✅ SKAdNetwork events: Subscribe (High) + Activate app (Low)
- ✅ Deep link verification completed for AEM
- ✅ Auto event logging enabled for both platforms

**Future updates:**
- Add `fb_mobile_purchase` event (after first subscriptions)
- Add `Complete Registration` event (after first user registrations)

---

## 🚀 Deployment Checklist

Before deploying to production:

1. ✅ Set Facebook credentials in code (App ID, Client Token, Pixel ID)
2. ✅ Set Access Token secret: `firebase functions:secrets:set FACEBOOK_ACCESS_TOKEN`
3. ✅ Configure Universal Links on `discovery.ozma.io` (iOS)
4. ✅ Configure App Links on `discovery.ozma.io` (Android)
5. ✅ Configure Events Manager (iOS/Android platforms + SKAdNetwork events)
6. ✅ Rebuild apps: `npx expo prebuild`
7. ✅ Deploy Cloud Functions: `firebase deploy --only functions`
8. ✅ Test with simulated deep links
9. ✅ Monitor events in Facebook Events Manager
10. ✅ Set up conversion optimization in Meta Ads Manager

---

## 📚 Additional Resources

- [Facebook Conversions API Documentation](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [Facebook App Events Documentation](https://developers.facebook.com/docs/app-events)
- [Apple Universal Links](https://developer.apple.com/ios/universal-links/)
- [Android App Links](https://developer.android.com/training/app-links)

