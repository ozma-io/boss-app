# Facebook actionSource Fix

## Problem

The third event (web-proxy) was NOT being sent with the correct `action_source` when sending events to Meta.

**Root Cause:**
- Cloud Function `functions/src/facebook.ts` had hardcoded `action_source: 'app'`
- The `actionSource` parameter was not being passed from client to Cloud Function
- All events (including web-proxy) were being sent with `action_source: 'app'`

**Result:**
Facebook didn't recognize the third event as a web conversion, which violated the purpose of sending web-proxy events for web campaign optimization.

## Solution

### 1. Created shared type `FacebookActionSource`

To avoid duplication, created the `FacebookActionSource` type:

**Client** (`services/facebook.service.ts`):
```typescript
export type FacebookActionSource = 
  | 'app'                    // Mobile app or desktop app
  | 'website'                // Website
  | 'email'                  // Email
  | 'phone_call'             // Phone call
  | 'chat'                   // Chat (e.g., Messenger, WhatsApp)
  | 'physical_store'         // Physical store
  | 'system_generated'       // System generated (e.g., server-side logic)
  | 'business_messaging'     // Business messaging
  | 'other';                 // Other
```

**Cloud Function** (`functions/src/facebook.ts`):
- Same type with comment that it must match the client-side definition
- (Cloud Functions is a separate project, cannot import from client)

### 2. Cloud Function (`functions/src/facebook.ts`)

- ✅ Created `FacebookActionSource` type with synchronization comment
- ✅ Use `FacebookActionSource` in `FacebookConversionEventData` interface
- ✅ Added `actionSource` validation at function start
- ✅ Use `action_source: eventData.actionSource` instead of `'app'`
- ✅ Added `actionSource` to logs

### 3. Client (`services/facebook.service.ts`)

- ✅ Created and exported `FacebookActionSource` type
- ✅ Use `FacebookActionSource` in `ConversionEventParams`
- ✅ Use `FacebookActionSource` in `ConversionEventData`
- ✅ Use `FacebookActionSource` in `sendConversionEvent()` (4th position)
- ✅ Removed all default values `|| 'app'`
- ✅ Updated all calls with explicit `actionSource` parameter
- ✅ Added `actionSource` to logs

### Function Signature Changes

**Before:**
```typescript
sendConversionEvent(
  userId: string | undefined,
  eventId: string,
  eventName: string,
  userData?: {...},
  customData?: Record<string, string | number | boolean>,
  attributionData?: AttributionData,
  actionSource?: 'app' | 'website' | ... // optional, last parameter
): Promise<void>
```

**After:**
```typescript
sendConversionEvent(
  userId: string | undefined,
  eventId: string,
  eventName: string,
  actionSource: FacebookActionSource, // REQUIRED, 4th parameter
  userData?: {...},
  customData?: Record<string, string | number | boolean>,
  attributionData?: AttributionData
): Promise<void>
```

**Benefits:**
- ✅ Cannot forget to specify `actionSource`
- ✅ TypeScript will error on incorrect parameter order
- ✅ Single `FacebookActionSource` type instead of duplicating union type
- ✅ No implicit default values

## Usage Examples

### AppInstall ('app' only)
```typescript
sendConversionEvent(userId, eventId, FB_MOBILE_ACTIVATE_APP, 'app', userData, undefined, attributionData)
```

### Registration (triple-send)
```typescript
// Event #1: app
sendConversionEvent(userId, eventId, FB_MOBILE_COMPLETE_REGISTRATION, 'app', { email }, customData, attributionData)

// Event #2: website
sendConversionEvent(userId, webProxyEventId, 'AppWebProxyLogin', 'website', { email }, customData, attributionData)
```

### First Chat Message (triple-send)
```typescript
// Event #1: app
sendConversionEvent(userId, eventId, FB_MOBILE_ACHIEVEMENT_UNLOCKED, 'app', { email }, customData, attributionData)

// Event #2: website
sendConversionEvent(userId, webProxyEventId, 'AppWebProxyFirstChatMessage', 'website', { email }, customData, attributionData)
```

## 🔄 Additional Optimizations for Web-Proxy Events

To make web-proxy events as close as possible to real website events:

### 1. **Removed `app_data` for web events**
- ✅ `app_data` (with `extinfo`, `advertiser_tracking_enabled`, `application_tracking_enabled`) is sent **ONLY** for `action_source: 'app'`
- ✅ For `action_source: 'website'` these fields are **NOT sent** - just like real website events

### 2. **Removed hashing of `external_id`**
- ✅ Firebase UID is sent **in raw form** (not hashed)
- Reason: It's already a random ID, contains no PII

### 3. **Removed unused fields**
- ❌ Removed from interface: `phone`, `firstName`, `lastName`, `city`, `state`, `zip`, `country`
- ✅ Kept: `email` (hashed), `external_id` (not hashed)

### 4. **Updated API version**
- ✅ Boss-App: `v24.0` (latest version)
- ✅ Web-Funnels: updated from `v18.0` to `v24.0`

## Deployment

After changes, deploy the Cloud Function:

```bash
cd functions
npm run deploy
```

Or deploy only this function:

```bash
firebase deploy --only functions:sendFacebookConversionEvent
```

## Verification

### Event with `action_source: 'app'`
```json
{
  "event_name": "fb_mobile_achievement_unlocked",
  "action_source": "app",
  "user_data": {
    "em": "hashed_email",
    "external_id": "firebase_uid_raw",
    "fbc": "fb.1.xxx.yyy",
    "fbp": "fb.1.zzz"
  },
  "app_data": {  // ✅ Present
    "advertiser_tracking_enabled": 1,
    "application_tracking_enabled": 1,
    "extinfo": ["i2", "com.ozmaio.bossup", ...]
  }
}
```

### Event with `action_source: 'website'`
```json
{
  "event_name": "AppWebProxyFirstChatMessage",
  "action_source": "website",
  "user_data": {
    "em": "hashed_email",
    "external_id": "firebase_uid_raw",
    "fbc": "fb.1.xxx.yyy",
    "fbp": "fb.1.zzz"
  }
  // ❌ app_data is absent - maximally similar to web event
}
```

In Facebook Events Manager, the third event should appear with correct `action_source: website` and WITHOUT mobile metadata.
