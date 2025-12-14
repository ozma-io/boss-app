# Facebook Attribution Matching Process

Technical description of the process for saving and matching attribution data when installing an app through Facebook ads.

---

## 📍 Stage 1: AD CLICK

### What happens:

```
User clicks on ad
       ↓
Redirect through l.facebook.com
       ↓
Facebook generates fbclid and saves data
```

### What Facebook SAVES:

#### Deterministic Identifiers (exact, if available):

```javascript
{
  // Unique click ID
  fbclid: "IwAR2xYz...",
  
  // IDFA (if user is logged into Facebook app)
  // Facebook obtains via cross-app communication with Facebook app
  // Before iOS 14.5: always available
  // After iOS 14.5: only if ATT was granted earlier
  idfa: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
  
  // IDFV (if click from Facebook app)
  idfv: "YYYYYYYY-YYYY-YYYY-YYYY-YYYYYYYYYYYY",
  
  // Facebook User ID (if logged in)
  fb_user_id: "1234567890",
  
  // Facebook Browser Cookie (if click in FB app)
  fb_browser_id: "cookie_value",
}
```

**⚠️ Important:** IDFA on click is available ONLY if:
- Click happens **inside Facebook/Instagram app** (not Safari)
- OR user previously granted ATT permission to another app
- OR iOS < 14.5

#### Probabilistic Signals (probabilistic, always available):

```javascript
{
  // Network
  ip: "192.168.1.1",
  ip_subnet: "192.168.1.0/24",
  isp: "AT&T",
  
  // Device (from User-Agent)
  user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0...",
  device_model: "iPhone 14 Pro",
  os_version: "16.0",
  browser: "Safari",
  
  // Screen
  screen_width: 1179,
  screen_height: 2556,
  screen_density: 3.0,
  
  // Locale
  language: "en-US",
  timezone: "America/New_York",
  timezone_offset: -240,
  
  // Timestamp
  click_time: "2024-11-19T16:30:45.123Z",
}
```

#### Campaign Data:

```javascript
{
  campaign_id: "123456789",
  ad_set_id: "987654321",
  ad_id: "111222333",
  
  // UTM parameters
  utm_source: "facebook",
  utm_medium: "cpc",
  utm_campaign: "install_campaign",
}
```

### Where it's stored:

Facebook saves data in multiple tables for fast lookup:

```javascript
// Main table
Table: clicks
Key: fbclid = "IwAR2xYz..."
Value: {
  // Deterministic
  idfa: "XXXX-..." (if available),
  idfv: "YYYY-...",
  fb_user_id: "1234567890" (if available),
  
  // Probabilistic
  ip: "192.168.1.1",
  ip_subnet: "192.168.1.0/24",
  user_agent: "...",
  screen: { width: 1179, height: 2556, density: 3.0 },
  timezone: "America/New_York",
  language: "en-US",
  
  // Campaign
  campaign_id: "123456789",
  ad_id: "111222333",
  utm_source: "facebook",
  utm_campaign: "install_campaign",
  
  // Metadata
  click_time: "2024-11-19T16:30:45.123Z",
  expires_at: "2024-11-26T16:30:45.123Z", // +7 days
}

// Index tables for fast lookup
Table: clicks_by_idfa
Key: "XXXX-XXXX-..."
Value: fbclid = "IwAR2xYz..."

Table: clicks_by_idfv
Key: "YYYY-YYYY-..."
Value: fbclid = "IwAR2xYz..."

Table: clicks_by_fb_user
Key: "1234567890"
Value: fbclid = "IwAR2xYz..."

Table: clicks_by_fingerprint
Key: SHA256(ip + user_agent + screen + timezone + language)
Value: fbclid = "IwAR2xYz..."
```

**TTL: 7 days** (then data is automatically deleted)

---

## 📍 Stage 2: APP INSTALLATION

### What happens:

```
App Store → Installation → First launch
       ↓
Facebook SDK initializes
       ↓
Collects same information
       ↓
Sends to Facebook Attribution API
```

### What Facebook SDK COLLECTS:

```typescript
// React Native code (happens automatically on SDK initialization)
import { getIDFA } from 'react-native-idfa';
import DeviceInfo from 'react-native-device-info';
import { Dimensions, Platform } from 'react-native';

const installData = {
  // IDFA (KEY for deterministic matching!)
  // Available ONLY if:
  // - iOS < 14.5 (always)
  // - iOS >= 14.5 + ATT permission granted
  idfa: await getIDFA(), // "XXXX-..." or null
  
  // IDFV (Identifier for Vendor - always available)
  idfv: await DeviceInfo.getUniqueId(), // "YYYY-..."
  
  // IP address (determined on Facebook server during HTTP request)
  ip: request.ip, // "192.168.1.1"
  
  // Device info (from React Native API)
  user_agent: await DeviceInfo.getUserAgent(),
  // "Aida/1.0.0 (iPhone; iOS 16.0; Scale/3.00)"
  
  device_model: await DeviceInfo.getModel(), // "iPhone 14 Pro"
  os_version: await DeviceInfo.getSystemVersion(), // "16.0"
  
  screen_width: Dimensions.get('screen').width,   // 1179
  screen_height: Dimensions.get('screen').height, // 2556
  screen_scale: Dimensions.get('screen').scale,   // 3.0
  
  // Locale
  language: await DeviceInfo.getDeviceLocale(), // "en-US"
  timezone: await DeviceInfo.getTimezone(),     // "America/New_York"
  
  // Tracking permissions (obtained from ATT API)
  advertiser_tracking_enabled: attStatus === 'authorized', // true/false
  application_tracking_enabled: true,
  
  // Timestamp
  install_time: new Date().toISOString(), // "2024-11-19T17:00:00.000Z"
};

// Sent to Facebook Attribution API
await fetch('https://graph.facebook.com/v24.0/PIXEL_ID/activities', {
  method: 'POST',
  body: JSON.stringify({
    event: 'MOBILE_APP_INSTALL',
    advertiser_id: installData.idfa,
    advertiser_tracking_enabled: installData.advertiser_tracking_enabled,
    application_tracking_enabled: true,
    extinfo: await buildExtinfo(), // 16-element array (see below)
    install_timestamp: Math.floor(Date.now() / 1000),
  }),
});
```

### Structure of extinfo array (16 elements):

```typescript
// utils/deviceInfo.ts - buildExtinfo()
const extinfo = [
  'i2',                                    // [0] version (always 'i2')
  await DeviceInfo.getBundleId(),         // [1] com.aida.app
  await DeviceInfo.getVersion(),          // [2] 1.0.0
  await DeviceInfo.getSystemVersion(),    // [3] 16.0
  await DeviceInfo.getModel(),            // [4] iPhone14,3
  await DeviceInfo.getDeviceLocale(),     // [5] en-US
  await DeviceInfo.getTimezone(),         // [6] America/New_York
  await DeviceInfo.getCarrier(),          // [7] AT&T
  Dimensions.get('screen').width,         // [8] 1179
  Dimensions.get('screen').height,        // [9] 2556
  Dimensions.get('screen').scale,         // [10] 3.0
  await DeviceInfo.getTotalMemory(),      // [11] 6442450944
  await DeviceInfo.getTotalDiskCapacity(),// [12] 128000000000
  await DeviceInfo.getFreeDiskStorage(),  // [13] 50000000000
  '',                                     // [14] reserved
  '',                                     // [15] reserved
];
```

---

## 📍 Stage 3: MATCHING

Facebook Attribution API tries several methods in priority order:

### Method 1: Deterministic Match (100% accuracy)

#### 1A. Match by IDFA (most reliable):

```python
if install_data.idfa:
    click = db.find_by_idfa(install_data.idfa)
    if click and not expired(click):
        return {
            'method': 'deterministic_idfa',
            'confidence': 100,
            'fbclid': click.fbclid,
            'attribution': click.campaign_data
        }
```

**Requirements:**
- ✅ ATT permission granted
- ✅ IDFA available on click AND on install
- ✅ Click not older than 7 days

#### 1B. Match by IDFV + IP:

```python
if install_data.idfv:
    clicks = db.find_by_idfv_and_ip_subnet(
        install_data.idfv,
        install_data.ip_subnet
    )
    if len(clicks) == 1:
        return {
            'method': 'deterministic_idfv',
            'confidence': 95,
            'fbclid': clicks[0].fbclid
        }
```

**Limitation:** IDFV changes when reinstalling apps from the same developer

#### 1C. Match by Facebook User ID:

```python
if install_data.fb_user_id:
    click = db.find_by_fb_user_id(install_data.fb_user_id)
    if click:
        return {
            'method': 'deterministic_fb_user',
            'confidence': 100,
            'fbclid': click.fbclid
        }
```

**Requirements:**
- ✅ User logged into Facebook app
- ✅ App uses Facebook Login

---

### Method 2: Probabilistic Match (85-95% accuracy)

If deterministic didn't work, fingerprinting is used:

```python
# Create fingerprint from install data
install_fingerprint = create_fingerprint(install_data)

# Find similar clicks in last 24 hours
recent_clicks = db.find_recent_clicks(
    ip_subnet=install_data.ip_subnet,
    platform='ios',
    time_window=24_hours
)

# Calculate similarity score
best_match = None
best_score = 0

for click in recent_clicks:
    score = calculate_similarity(
        install_fingerprint,
        click.fingerprint
    )
    if score > best_score:
        best_score = score
        best_match = click

# Threshold 85%
if best_score > 0.85:
    return {
        'method': 'probabilistic',
        'confidence': int(best_score * 100),
        'fbclid': best_match.fbclid
    }
```

#### Similarity Score (weighted sum):

| Parameter | Weight | Description |
|----------|-----|----------|
| **IP address** | 40% | Exact match or same subnet |
| **User-Agent** | 20% | User-Agent string comparison |
| **Screen resolution** | 15% | Width + Height + Density |
| **Timezone** | 10% | Exact timezone match |
| **Language** | 10% | Locale match |
| **Device model** | 5% | Device model |

**Example:**
```
IP matched: +0.40
User-Agent matched 95%: +0.19
Screen matched: +0.15
Timezone matched: +0.10
Language matched: +0.10
Device matched: +0.05
───────────────────────────
Total: 0.99 (99% confidence) ✅
```

---

## 📊 Scenarios

### Scenario 1: ✅ With ATT permission (ideal)

```
1. Click (t=0):
   Facebook saves: fbclid + IDFA + fingerprint

2. Install (t=30 min):
   ATT permission granted ✅
   SDK sends: IDFA + fingerprint

3. Matching:
   IDFA matched → Deterministic match (100%)
   Returns: fbclid + campaign_id

4. App Install event:
   {
     fbclid: "IwAR2x...",
     advertiserTrackingEnabled: true,
     attribution: 'deterministic',
     confidence: 100
   }
```

**Result:** Facebook knows exactly which ad led to the install ✅

**What happens in code:**
```typescript
// 1. Request ATT permission
const attStatus = await requestTrackingPermission();
// attStatus = 'authorized' ✅

// 2. Get deferred deep link from Facebook SDK
const deferredUrl = await AppEventsLogger.fetchDeferredAppLink();
// deferredUrl = "https://yourapp.com/?fbclid=IwAR2x..." ✅

// 3. Parse parameters
const attribution = parseDeepLinkParams(deferredUrl);
// { fbclid: "IwAR2x...", utm_source: "facebook", ... }

// 4. Send App Install event
await sendAppInstallEventDual(userId, attribution, { email: userEmail });
// Facebook receives: external_id + email + fbclid + advertiserTrackingEnabled: true ✅
```

---

### Scenario 2: ⚠️ WITHOUT ATT permission (probabilistic)

```
1. Click (t=0):
   Facebook saves: fbclid + fingerprint (NO IDFA)

2. Install (t=30 min):
   ATT permission denied ❌
   SDK sends: fingerprint (NO IDFA)

3. Matching:
   IDFA unavailable → Probabilistic match
   Compares: IP + User-Agent + Screen + Timezone
   Similarity: 92% → MATCH ⚠️
   Returns: fbclid + campaign_id

4. App Install event:
   {
     fbclid: "IwAR2x...",
     advertiserTrackingEnabled: false,
     attribution: 'probabilistic',
     confidence: 92
   }
```

**Result:** Facebook probably knows the source (92% confidence) ⚠️

**What happens in code:**
```typescript
// 1. Request ATT permission
const attStatus = await requestTrackingPermission();
// attStatus = 'denied' ❌

// 2. Get deferred deep link (still works via fingerprint)
const deferredUrl = await AppEventsLogger.fetchDeferredAppLink();
// deferredUrl = "https://yourapp.com/?fbclid=IwAR2x..." ⚠️ (92% confidence)

// 3. Parse parameters
const attribution = parseDeepLinkParams(deferredUrl);
// { fbclid: "IwAR2x...", utm_source: "facebook", ... }

// 4. Send App Install event
await sendAppInstallEventDual(userId, attribution, { email: userEmail });
// Facebook receives: external_id + email + fbclid + advertiserTrackingEnabled: false ⚠️
```

**⚠️ Note:** Facebook SDK may not return deferred link if probabilistic matching confidence < 85%

---

### Scenario 3: ❌ IP changed (WiFi → LTE)

```
1. Click (t=0, WiFi):
   IP: 192.168.1.1

2. Install (t=30 min, LTE):
   IP: 10.20.30.40

3. Matching:
   IP didn't match ❌ (-40%)
   User-Agent matched ✅ (+20%)
   Screen matched ✅ (+15%)
   Timezone matched ✅ (+10%)
   Language matched ✅ (+10%)
   Device matched ✅ (+5%)
   ────────────────────────
   Total: 60% < 85% threshold

   Similarity: 60% → NO MATCH ❌

4. App Install event:
   {
     fbclid: null,
     attribution: 'organic'
   }
```

**Result:** Facebook DOESN'T know the source (considers organic install) ❌

**What happens in code:**
```typescript
// 1. Request ATT permission
const attStatus = await requestTrackingPermission();
// attStatus = 'denied' ❌

// 2. Try to get deferred deep link
const deferredUrl = await AppEventsLogger.fetchDeferredAppLink();
// deferredUrl = null ❌ (similarity 60% < 85% threshold)

// 3. No attribution data
const attribution = deferredUrl ? parseDeepLinkParams(deferredUrl) : {};
// attribution = {}

// 4. Send App Install event WITHOUT fbclid
await sendAppInstallEventDual(userId, attribution, { email: userEmail });
// Facebook receives: external_id + email, fbclid: null, attribution: 'organic' ❌
```

---

## 🎯 Key Conclusions

### What affects matching success:

| Factor | Impact on accuracy |
|--------|-------------------|
| **ATT permission** | 100% vs 85-95% |
| **IP address stable** | +40% to probabilistic |
| **Facebook app installed** | Can provide IDFA on click |
| **Time between click and install** | < 24h better (probabilistic) |
| **VPN/Proxy** | Degrades probabilistic |

### What Facebook receives in App Install event:

```typescript
{
  eventName: 'AppInstall',
  eventTime: 1700412000,
  eventId: 'unique-uuid',
  
  // ❗ KEY FIELDS
  advertiserTrackingEnabled: true/false,  // ATT status
  applicationTrackingEnabled: true,
  
  // Attribution (if match found)
  fbclid: 'IwAR2x...',                    // or null
  
  // Device info
  extinfo: [/* 16 elements */],
  
  // User data (hashed)
  userData: {
    email: 'hashed...'
  },
  
  // Campaign (if match found)
  customData: {
    campaign_id: '123456789',
    utm_source: 'facebook',
    utm_campaign: 'install_campaign'
  }
}
```

---

## 📝 Recommendations for developers

### For maximum attribution accuracy:

1. **✅ Always request ATT permission**
   - Show onboarding screen with explanation
   - Request on first launch
   
2. **✅ Use Facebook SDK `fetchDeferredAppLink()`**
   - Call AFTER getting ATT permission
   - Handle case when deferred link is absent

3. **✅ Send App Install event with correct parameters**
   - Use dual-send (client + server)
   - Include `advertiserTrackingEnabled` status
   - Pass `fbclid` if found

4. **⚠️ Consider probabilistic matching limitations**
   - Accuracy 85-95% vs 100% with IDFA
   - May not work when IP changes
   - Requires stable internet

### For reliability in any scenario:

- Use **Branch.io** or **AppsFlyer** for deferred deep linking
- They combine deterministic + probabilistic methods
- Have better ML models for matching (95-98% accuracy)
- Work for all ad networks (not just Facebook)

---

## 💻 React Native Integration Example

### Option 1: Facebook SDK (free, FB ads only)

```typescript
// app/_layout.tsx
import { AppEventsLogger } from 'react-native-fbsdk-next';
import { requestTrackingPermission } from '@/services/tracking.service';
import { sendAppInstallEventDual } from '@/services/facebook.service';
import { isFirstLaunch, markAppAsLaunched } from '@/services/attribution.service';

useEffect(() => {
  const handleFirstLaunch = async () => {
    const firstLaunch = await isFirstLaunch();
    
    if (!firstLaunch) return;
    
    try {
      // 1. Request ATT permission
      logger.info('[App] Requesting ATT permission...');
      const attStatus = await requestTrackingPermission();
      logger.info('[App] ATT status:', { attStatus });
      
      // 2. Get deferred deep link from Facebook
      // IMPORTANT: call AFTER ATT permission for better accuracy
      logger.info('[App] Fetching deferred app link from Facebook...');
      const deferredUrl = await AppEventsLogger.fetchDeferredAppLink();
      
      if (deferredUrl) {
        logger.info('[App] Got deferred deep link! 🎉', { deferredUrl });
        
        // 3. Parse attribution parameters
        const attribution = parseDeepLinkParams(deferredUrl);
        logger.info('[App] Attribution data:', attribution);
        
        // 4. Send App Install event with fbclid
        await sendAppInstallEventDual(userId, attribution, {
          email: userEmail, // if available
        });
        
        logger.info('[App] App Install event sent successfully ✅');
      } else {
        logger.info('[App] No deferred deep link (organic install)');
        
        // Send App Install without attribution
        await sendAppInstallEventDual(undefined, {});
      }
      
      await markAppAsLaunched();
    } catch (error) {
      logger.error('[App] Error handling first launch:', error);
    }
  };

  handleFirstLaunch();
}, []);
```

**Requirements:**
- ✅ Installed `react-native-fbsdk-next`
- ⚠️ Facebook app MUST be installed on device
- ⚠️ User MUST be logged into Facebook app
- ⚠️ Works ONLY for Facebook/Instagram ads

---

### Option 2: Branch.io (paid, all sources)

```typescript
// app/_layout.tsx
import branch from 'react-native-branch';
import { requestTrackingPermission } from '@/services/tracking.service';
import { sendAppInstallEventDual } from '@/services/facebook.service';
import { isFirstLaunch, markAppAsLaunched } from '@/services/attribution.service';

useEffect(() => {
  const handleFirstLaunch = async () => {
    const firstLaunch = await isFirstLaunch();
    
    if (!firstLaunch) return;
    
    try {
      // 1. Request ATT permission
      const attStatus = await requestTrackingPermission();
      logger.info('[App] ATT status:', { attStatus });
      
      // 2. Subscribe to Branch events
      const unsubscribe = branch.subscribe({
        onOpenStart: () => {
          logger.info('[Branch] Session starting...');
        },
        onOpenComplete: async ({ error, params }) => {
          if (error) {
            logger.error('[Branch] Error:', error);
            return;
          }
          
          // 3. Check if user came via Branch link
          if (params['+clicked_branch_link']) {
            logger.info('[Branch] Got attribution! 🎉', params);
            
            // Extract attribution data
            const attribution = {
              fbclid: params.fbclid,
              utm_source: params.utm_source,
              utm_medium: params.utm_medium,
              utm_campaign: params.utm_campaign,
              utm_content: params.utm_content,
              email: params.email,
            };
            
            // 4. Send App Install event
            await sendAppInstallEventDual(userId, attribution, {
              email: params.email,
            });
            
            logger.info('[Branch] App Install event sent ✅');
            
            // Branch will automatically send postback to Facebook
            // if configured in Branch dashboard
          } else {
            logger.info('[Branch] Organic install');
            await sendAppInstallEventDual(undefined, {});
          }
          
          await markAppAsLaunched();
        },
      });
      
      return () => unsubscribe();
    } catch (error) {
      logger.error('[App] Error handling first launch:', error);
    }
  };

  handleFirstLaunch();
}, []);
```

**Advantages:**
- ✅ Does NOT require Facebook app on device
- ✅ Works for ALL sources (FB, Google, TikTok, email, SMS, etc.)
- ✅ Probabilistic matching 95-98% (vs 85-95% for Facebook SDK)
- ✅ Automatic postbacks to all ad networks
- ✅ Cross-device tracking (click on iPad → install on iPhone)

**Price:**
- Free tier: up to 10K MAU (Monthly Active Users)
- Paid: $299-999/month

---

## 📁 BossUp Implementation

### Files:

1. **`services/facebook.service.ts`**
   - `sendAppInstallEventDual()` - sends App Install event (lines 548-566)
   - `buildEventData()` - builds payload with ATT status (lines 178-210)
   - `parseDeepLinkParams()` - parses URL parameters (lines 356-378)

2. **`utils/deviceInfo.ts`**
   - `buildExtinfo()` - creates 16-element array for Facebook
   - `getAdvertiserTrackingEnabled()` - gets ATT status

3. **`services/tracking.service.ts`**
   - `requestTrackingPermission()` - requests ATT permission
   - `getTrackingPermissionStatus()` - checks current status

4. **`app/_layout.tsx`**
   - Handles first launch (lines 200-250)
   - Parses deep links
   - Sends Facebook events

5. **`functions/src/facebook.ts`** (Cloud Function)
   - `sendFacebookConversionEvent` - sends to Conversions API
   - Hashes user data
   - Retry logic

### Usage example in BossUp:

```typescript
// app/_layout.tsx (simplified version)

const firstLaunch = await isFirstLaunch();

if (firstLaunch) {
  // Get initial URL (deep link)
  const url = await Linking.getInitialURL();
  let attributionData = null;
  
  if (url) {
    // Parse attribution from URL
    attributionData = parseDeepLinkParams(url);
    logger.info('[App] Got attribution from deep link', attributionData);
  }
  
  // If there is Facebook attribution
  if (attributionData?.fbclid || attributionData?.utm_source === 'facebook') {
    // iOS: show tracking onboarding before ATT
    if (Platform.OS === 'ios') {
      router.push('/tracking-onboarding');
      // Will request ATT and send App Install event there
    } else {
      // Android: send immediately
      await sendAppInstallEventDual(userId, attributionData);
    }
  }
  
  await markAppAsLaunched();
}
```

---

## ⚠️ Important Limitations

### Facebook SDK `fetchDeferredAppLink()`:

1. **Requires Facebook app on device**
   - If user doesn't have Facebook app → method will return `null`
   - If user not logged into FB app → accuracy decreases

2. **Works only for Facebook/Instagram ads**
   - Doesn't work for Google Ads, TikTok, email campaigns, etc.

3. **Probabilistic matching is limited**
   - If IP changed → may not find match
   - If VPN/Proxy → may not find match
   - If too much time passed (>24h) → accuracy drops

4. **iOS 14.5+ issues**
   - ~70% of users decline ATT
   - Without IDFA accuracy drops from 100% to 85-95%

### Production alternatives:

| Solution | Accuracy | Requires FB app | All sources | Price |
|---------|----------|---------------|---------------|------|
| **Facebook SDK** | 85-95% | Yes ⚠️ | No ❌ | Free ✅ |
| **Branch.io** | 95-98% | No ✅ | Yes ✅ | $0-299/mo |
| **AppsFlyer** | 95-98% | No ✅ | Yes ✅ | $0-449/mo |
| **Adjust** | 95-98% | No ✅ | Yes ✅ | Custom pricing |

---

**Last updated:** 2024-11-19

