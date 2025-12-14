# Facebook Events Tracking in Amplitude

## Overview

All Facebook events sent from the app and website are now tracked in Amplitude using a single consolidated event: `facebook_event_sent`.

## Naming Convention

Following Amplitude naming conventions from `docs/amplitude-naming-convention.md`:
- Event name: `facebook_event_sent` (snake_case, past tense)
- All details passed as event parameters

## Implementation

### Boss-App (Mobile)

**Location:** `services/facebook.service.ts`

**Helper Function:** `trackFacebookEventToAmplitude()`
- Consolidates 2-3 Facebook events (client + server app + server website) into 1 Amplitude event
- Prevents noise in Amplitude from duplicate Facebook sends
- Called automatically after each Facebook event function completes

**Tracked Facebook Events:**
1. **App Install** (`fb_mobile_activate_app`)
   - Dual-send: client + server (app)
   - Parameters: `send_method`, `client_sent`, `server_app_sent`, `event_id`, `action_source`, `has_attribution`, `has_email`

2. **Registration** (`fb_mobile_complete_registration`)
   - Triple-send: client + server (app) + server (website proxy)
   - Parameters: Same as above + `server_website_sent`, `registration_method`, `web_proxy_event_id`

3. **First Chat Message** (`fb_mobile_achievement_unlocked`)
   - Triple-send: client + server (app) + server (website proxy)
   - Parameters: Same as Registration + `description`, `achievement_id`

4. **Second Chat Message** (`SecondChatMessage`)
   - Triple-send: client + server (app) + server (website proxy)
   - Parameters: Same as First Chat Message + `message_number`

### Web-Funnels (Website)

**Location:** `app/utils/facebookPixel.ts`

**Implementation:** Modified `fbTrack()` function
- Tracks success/failure of browser and server sends
- Creates single Amplitude event per Facebook event
- Parameters: `fb_event_name`, `fb_event_type`, `send_method`, `client_sent`, `server_website_sent`, `event_id`, `action_source`, `has_attribution`, plus all original Facebook event params

## Event Parameters

### Standard Parameters (All Events)
```typescript
{
  fb_event_name: string           // Facebook event name (e.g., 'fb_mobile_complete_registration')
  send_method: string             // 'client' | 'dual' | 'triple'
  client_sent: boolean            // Whether client-side event succeeded
  event_id: string                // Facebook event ID for deduplication
  action_source: string           // 'app' | 'website'
  has_attribution: boolean        // Whether attribution data (fbc/fbp) present
}
```

### Mobile-Specific Parameters
```typescript
{
  server_app_sent: boolean        // Whether server-side (app) event succeeded
  server_website_sent: boolean    // Whether server-side (website proxy) event succeeded
  has_email: boolean              // Whether user email included
  web_proxy_event_id?: string     // Separate event ID for website proxy event
}
```

### Web-Specific Parameters
```typescript
{
  fb_event_type: string           // 'standard' | 'custom'
  server_website_sent: boolean    // Whether server-side event succeeded
  // Plus all original Facebook event params (content_name, step_number, etc.)
}
```

## Benefits

1. **Single Source of Truth:** One Amplitude event per user action, regardless of how many Facebook events were sent
2. **Complete Visibility:** Track which sends succeeded/failed (client, server app, server website)
3. **Attribution Tracking:** Know which events have attribution data
4. **Debugging:** Event IDs allow cross-referencing with Facebook Events Manager
5. **Follows Conventions:** Proper snake_case naming with feature prefix

## Example Amplitude Event

```json
{
  "event_name": "facebook_event_sent",
  "properties": {
    "fb_event_name": "fb_mobile_complete_registration",
    "send_method": "triple",
    "client_sent": true,
    "server_app_sent": true,
    "server_website_sent": true,
    "event_id": "1234567890-abc123",
    "web_proxy_event_id": "1234567891-def456",
    "action_source": "app",
    "has_attribution": true,
    "has_email": true,
    "registration_method": "email"
  }
}
```

## Testing

To verify implementation:
1. Trigger any Facebook event (registration, chat message, etc.)
2. Check Amplitude dashboard for `facebook_event_sent` event
3. Verify all parameters are present and correct
4. Confirm only 1 Amplitude event per user action (not 2-3)

## Notes

- Amplitude tracking errors won't break Facebook tracking (wrapped in try-catch)
- All Facebook event details preserved in Amplitude parameters
- Works for both standard and custom Facebook events
- Consistent implementation across mobile app and website
