# Amplitude Events Naming Convention

Simple rules for naming custom Amplitude events.

## Philosophy: Less is More

**Core principle:** Track only what you actually need for decision-making. Use minimum events + maximum properties.

### The Sweet Spot

Find the balance between generic and specific:

- ❌ **Too Generic**: `button_clicked` — which button? where?
- ✅ **Just Right**: `auth_signin_clicked` — clear action + properties for variants
- ❌ **Too Specific**: `welcome_screen_primary_email_signin_button_clicked` — too long!

**Goal:** Event name should be clear and self-explanatory, but use properties for variants (like method, screen, etc.)

## Basic Format

```
feature_object_action
```

**Examples:**
- ✅ `auth_signin_clicked`
- ✅ `auth_form_submitted`
- ✅ `timeline_entry_viewed`
- ❌ `click_button` (wrong order)
- ❌ `Button Clicked` (not snake_case)
- ❌ `button_clicked` (too generic)

## Rules

### 1. Name Structure
- **feature/screen prefix** (where?) - groups related events (optional but recommended)
- **object** (what?) - noun, describes the object
- **action** (what happened?) - verb in past tense
- Use **snake_case** (lowercase with underscores)
- Be specific but concise

### 2. Past Tense Verbs
- ✅ `clicked`, `submitted`, `viewed`, `changed`, `selected`
- ❌ `click`, `submit`, `view`, `change`, `select`

### 3. Be Specific, But Don't Overdo It
- ✅ `auth_signin_clicked` — clear what it is
- ✅ `timeline_viewed` — clear which screen
- ❌ `button_clicked` — too generic, which button?
- ❌ `auth_welcome_screen_email_signin_button_clicked` — too long!

### 4. Grouping by Features/Screens
Add a prefix with screen or feature name for grouping:

```typescript
// Auth flow
trackAmplitudeEvent("auth_email_changed");
trackAmplitudeEvent("auth_signin_clicked");
trackAmplitudeEvent("auth_magic_link_sent");

// Timeline
trackAmplitudeEvent("timeline_entry_clicked");
trackAmplitudeEvent("timeline_filter_applied");

// Chat
trackAmplitudeEvent("chat_message_sent");
trackAmplitudeEvent("chat_opened");
```

### 5. 🔥 Balance: Specific Names + Smart Properties
Find the sweet spot between being specific and avoiding too many similar events:

```typescript
// ✅ GOOD: specific enough, use properties for variants
trackAmplitudeEvent("auth_signin_clicked", {
  method: "email",     // or "google", "apple"
  screen: "welcome"
});

// ✅ ALSO GOOD: grouped by feature, properties for details
trackAmplitudeEvent("timeline_entry_clicked", {
  entry_type: "note",
  entry_id: "123"
});

// ❌ TOO GENERIC: what signin? where?
trackAmplitudeEvent("button_clicked", {
  button_name: "signin"
});

// ❌ TOO SPECIFIC: too many similar events
trackAmplitudeEvent("welcome_screen_email_signin_button_clicked");
trackAmplitudeEvent("welcome_screen_google_signin_button_clicked");
trackAmplitudeEvent("welcome_screen_apple_signin_button_clicked");
```

## Minimal Event Set by Category

Keep the number of events minimal. Better to have 10 well-thought-out events than 100 similar ones.

### Auth & Onboarding
```typescript
"auth_signin_clicked"       // + property: method (email/google/apple), screen
"auth_signin_completed"     // + property: method (email/google/apple), email
"auth_email_submitted"      // user entered email
"auth_magic_link_opened"    // user clicked magic link
"auth_signout_completed"    // + property: email
"onboarding_completed"      // + property: step_count, duration_seconds
```

### Navigation & Screen Views
```typescript
// Specific screen view events (preferred for small number of screens)
"welcome_screen_viewed"
"email_input_screen_viewed"
"email_confirm_screen_viewed"
"home_screen_viewed"
"boss_details_screen_viewed"
"boss_timeline_screen_viewed"
"chat_screen_viewed"
"entry_details_screen_viewed"
"notification_onboarding_screen_viewed"
"personal_info_screen_viewed"
"subscription_screen_viewed"
"tracking_onboarding_screen_viewed"

// Alternative: generic screen view event (use when you have many screens)
"screen_viewed"             // + property: screen_name, source
"tab_switched"              // + property: tab_name, previous_tab
"modal_opened"              // + property: modal_name, trigger
```

### Content
```typescript
"entry_created"             // + property: entry_type, has_photo
"entry_updated"             // + property: entry_type, field_changed
"entry_deleted"             // + property: entry_type, entry_age_days
"timeline_entry_clicked"    // + property: entry_type, entry_id
```

### Conversions
```typescript
"subscription_started"      // + property: plan_type, price
"payment_completed"         // + property: amount, currency
"trial_started"
```

## Usage Examples

```typescript
import { trackAmplitudeEvent } from '@/services/amplitude.service';

// ✅ Auth flow - specific action, method as property
trackAmplitudeEvent("auth_signin_clicked", {
  method: "email",
  screen: "welcome"
});

// ✅ Screen view - manual tracking for full control
trackAmplitudeEvent("screen_viewed", {
  screen_name: "welcome",
  source: "deep_link"  // or "navigation", "push_notification"
});

// ✅ Content creation - grouped by feature
trackAmplitudeEvent("entry_created", {
  entry_type: "note",
  has_photo: false,
  boss_id: "boss123",
  character_count: 150
});

// ✅ Content interaction - specific but not too detailed
trackAmplitudeEvent("timeline_entry_clicked", {
  entry_type: "survey",
  entry_id: "entry123",
  position: 3  // position in list
});

// ✅ Conversion event
trackAmplitudeEvent("subscription_started", {
  plan_type: "premium",
  price: 9.99,
  currency: "USD",
  trial_eligible: true
});
```

## Best Practices

1. **Be Specific, Not Generic**: Use `auth_signin_clicked` instead of `button_clicked`. Event name should be clear without looking at properties.
2. **Find the Sweet Spot**: Not too generic (`button_clicked`) and not too specific (`welcome_screen_primary_blue_signin_button_clicked`)
3. **Group by Feature**: Use prefixes like `auth_*`, `timeline_*`, `chat_*` — easy to filter in dashboards
4. **Properties for Variants**: One `auth_signin_clicked` event with `method` property, not separate events for each method
5. **Manual Tracking = Full Control**: Track important screens/actions manually even if auto-tracked — you get custom properties and full control
6. **Be Consistent**: Always snake_case, always past tense, same words for similar actions
7. **Minimalism**: Ask "Will this help make a decision?" If unsure — don't track it

## When NOT to Track

- ❌ Technical implementation details (you don't need them for analytics)
- ❌ Too frequent events (every keystroke in input — bad idea)
- ❌ Sensitive user data (passwords, tokens, etc.)
- ❌ "Just in case" events — if you don't know why, don't track it
- ❌ Events that don't help make decisions or understand user behavior

**Note:** Even though Amplitude auto-tracks some events (Page Views, Sessions), you may want to manually track important screens/actions for full control and custom properties.

## Checklist Before Adding an Event

Ask yourself these questions:

- [ ] Is this actually needed for decision-making?
- [ ] Can I use an existing event + properties instead?
- [ ] Is the name in `object_action` format using snake_case?
- [ ] Is the verb in past tense?
- [ ] Is it **specific enough** to understand without properties? (not just `button_clicked`)
- [ ] Is it **not too long**? (avoid `welcome_screen_primary_email_signin_button_clicked`)
- [ ] Does it have a **feature/screen prefix** for easy grouping? (`auth_*`, `timeline_*`)
- [ ] Are properties used for **variants and context**, not for the main action?

## Examples: Good vs Bad

### ❌ Bad: Too Generic
```typescript
trackAmplitudeEvent("button_clicked", {
  button_name: "signin"
});
trackAmplitudeEvent("link_tapped", {
  link_name: "profile"
});
// Hard to filter and understand in dashboard
```

### ✅ Good: Specific and Grouped
```typescript
trackAmplitudeEvent("auth_signin_clicked", {
  method: "email"
});
trackAmplitudeEvent("profile_link_clicked", {
  source: "settings"
});
// Easy to find all auth events with "auth_*" filter
```

### ❌ Bad: Too Many Similar Events
```typescript
trackAmplitudeEvent("welcome_email_signin_clicked");
trackAmplitudeEvent("welcome_google_signin_clicked");
trackAmplitudeEvent("welcome_apple_signin_clicked");
trackAmplitudeEvent("settings_email_signin_clicked");
trackAmplitudeEvent("settings_google_signin_clicked");
// 50+ similar events...
```

### ✅ Good: One Event + Smart Properties
```typescript
trackAmplitudeEvent("auth_signin_clicked", {
  method: "email",  // or "google", "apple"
  screen: "welcome" // or "settings"
});
// One event, all variations covered
```

### ❌ Bad: Inconsistent Naming
```typescript
trackAmplitudeEvent("userClickedSignIn");
trackAmplitudeEvent("Form_Submitted");
trackAmplitudeEvent("screen-viewed");
```

### ✅ Good: Consistent snake_case
```typescript
trackAmplitudeEvent("auth_signin_clicked");
trackAmplitudeEvent("auth_form_submitted");
trackAmplitudeEvent("screen_viewed");
```

