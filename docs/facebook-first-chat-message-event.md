# Facebook First Chat Message Event

## Overview

Sending `fb_mobile_achievement_unlocked` event when user sends their first message to the AI assistant.

## Why fb_mobile_achievement_unlocked?

- **Standard Facebook Event** - official event for tracking user achievements/milestones
- **Meaningful Engagement** - first chat message shows actual product usage, not just registration
- **Campaign Optimization** - Facebook can optimize ads for users who actually use the core product feature
- **Custom Audiences** - build audiences of engaged users for retargeting and Lookalike

## Implementation

### 1. Dual-Send Approach

Event is sent from **both client and server** with the same `event_id` for deduplication:

- **Client-side**: via Facebook SDK (iOS/Android)
- **Server-side**: via Conversions API (Cloud Function)

### 2. Event Parameters

**Required Parameters:**
- `event_name`: `fb_mobile_achievement_unlocked`
- `event_id`: unique ID for deduplication between client and server
- `event_time`: UNIX timestamp (validated for Facebook requirements)
- `action_source`: `app`
- `user_data.em`: user email (automatically hashed with SHA-256)
- `user_data.external_id`: Firebase User ID (automatically hashed with SHA-256) - **CRITICAL for User Matching!**

**Additional Parameters for Better Attribution:**
- `user_data.fbc`: Facebook Click Cookie (if user came from ad)
- `user_data.fbp`: Facebook Browser ID (to link with web-funnel)
- `custom_data.description`: `first_chat_message`
- `custom_data.achievement_id`: `chat_first_message`
- `app_data.extinfo`: 16-element array with device information
- `app_data.advertiser_tracking_enabled`: ATT status (iOS 14.5+)
- `app_data.application_tracking_enabled`: app-level tracking permission

### 3. Data Sources

```typescript
// Firebase User ID (used as external_id for cross-channel matching)
const userId = user.id;  // Firebase UID

// User email from Firebase Auth
const email = user.email;

// Attribution data from Firestore (fbc, fbp, fbclid, utm_* parameters)
const attributionData = await getAttributionDataWithFallback(user.id);
// Fallback strategy:
// 1. First tries AsyncStorage (deep link params from mobile app install)
// 2. If no fbc/fbp, tries Firestore (data from web-funnel registration)
// 3. Merges data for maximum completeness
```

### 4. Code

**app/chat.tsx:**
```typescript
// After sending message, check if it's the first one
const { messageId, userMessageCount } = await sendMessage(user.id, threadId, textToSend);

if (userMessageCount === 1) {
  // Send event in background (don't block UX)
  (async () => {
    try {
      const attributionData = await getAttributionDataWithFallback(user.id);
      // Send with external_id (userId) + email + attribution for maximum matching
      await sendFirstChatMessageEventDual(user.id, user.email, attributionData || undefined);
    } catch (fbError) {
      // Log error but don't show to user
      logger.error('Failed to send first chat message Facebook event', { error: fbError });
    }
  })();
}
```

**services/facebook.service.ts:**
```typescript
export async function sendFirstChatMessageEventDual(
  userId: string,  // Firebase UID for external_id
  email: string, 
  attributionData?: AttributionData
): Promise<void> {
  const eventId = generateEventId();
  
  // Client params for Facebook SDK
  const clientParams = { 
    _eventId: eventId,
    fb_description: 'first_chat_message'
  };
  
  // Custom data for Conversions API
  const customData = {
    description: 'first_chat_message',
    achievement_id: 'chat_first_message'
  };
  
  // Dual-send: client + server in parallel
  const results = await Promise.allSettled([
    // Client-side: Facebook SDK
    AppEventsLogger.logEvent(FB_MOBILE_ACHIEVEMENT_UNLOCKED, clientParams),
    
    // Server-side: Conversions API (with external_id for user matching)
    sendConversionEvent(userId, eventId, FB_MOBILE_ACHIEVEMENT_UNLOCKED, { email }, customData, attributionData)
  ]);
  
  // Check results (at least one should succeed)
  const [clientResult, serverResult] = results;
  if (clientResult.status === 'rejected' && serverResult.status === 'rejected') {
    throw new Error('Both client and server events failed');
  }
}
```

## Why This Is Reliable

1. **Deduplication** - Facebook automatically removes duplicates by `event_id` + `event_name`
2. **Fallback** - if client doesn't send (offline), server will handle it
3. **Maximum Attribution** - using all available data:
   - email for User Matching
   - external_id for cross-channel linking
   - fbc for ad campaign attribution
   - fbp for web-funnel linking
   - extinfo for Device Matching
4. **Async** - doesn't block user experience, works in background
5. **Error Handling** - errors are logged but not shown to user

## Event Match Quality

Facebook will rate event quality high due to:

- ✅ **Email** - hashed SHA-256, excellent for matching
- ✅ **External ID** - hashed SHA-256 Firebase UID, critical for cross-channel linking
- ✅ **fbc/fbp** - direct link to ads and web-funnel
- ✅ **extinfo** - complete device information
- ✅ **Tracking Permissions** - correct ATT/permission status
- ✅ **event_id** - proper deduplication
- ✅ **event_time** - correct timestamp validation

**Expected Event Match Quality: 70-85% (High Quality)**

## Event Verification

### Facebook Events Manager

1. Open [Facebook Events Manager](https://business.facebook.com/events_manager)
2. Select your Pixel/Dataset
3. **Test Events** tab - for real-time testing
4. **Overview** tab - for all events view
5. Search for events named `fb_mobile_achievement_unlocked`

### Check Event Match Quality

1. Events Manager → **Data Sources** → your Pixel
2. **Overview** → **Event Match Quality**
3. Should show high % of matched events (70%+)

### Testing

```bash
# 1. Run app in dev mode
npm run ios  # or npm run android

# 2. Sign in to account (or create new one)

# 3. Open chat and send FIRST message

# 4. Check logs
# - Console should show "Sending FirstChatMessage event"
# - Firebase Functions logs should show Cloud Function logs

# 5. Check Events Manager
# - Open Test Events in real-time
# - Should see fb_mobile_achievement_unlocked event
# - Check parameters (email, custom_data, user_data)
```

## Troubleshooting

### Event Not Appearing in Events Manager

1. **Check Logs** - `logger.info('FirstChatMessage ...')` should be in logs
2. **Check Facebook Access Token** - must be in Firebase Functions secrets
3. **Check Pixel ID** - must match in `constants/facebook.config.ts` and `functions/src/constants.ts`
4. **Check userMessageCount** - must be === 1 for first message

### Event Duplicates

- **Normal** - client and server send in parallel, Facebook removes duplicates by `event_id`
- **Verify** - Events Manager should show one event, not two

### Low Event Match Quality

1. **Check email** - must be valid and hashed
2. **Check attribution data** - fbc/fbp should be in Firestore
3. **Check extinfo** - must be array of 16 strings
4. **Check permissions** - advertiserTrackingEnabled and applicationTrackingEnabled

## Future Improvements

1. **Add Parameters:**
   - `fb_content`: first message text (truncated to 100 chars)
   - `fb_num_items`: message character count
   
2. **Add Other Milestone Events:**
   - First AI response (use same event with different achievement_id)
   - 10th message
   - First week of usage
   
3. **Custom Audiences:**
   - Create "Users who sent first message" audience for retargeting
   - Create Lookalike audience to find similar users

## Facebook Documentation

- [Conversions API Documentation](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [App Events Reference](https://developers.facebook.com/docs/app-events/reference)
- [Event Deduplication](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events)
- [Best Practices](https://developers.facebook.com/docs/marketing-api/conversions-api/best-practices)
- [External ID Parameter](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/external-id)

