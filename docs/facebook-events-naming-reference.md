# Facebook App Events - Naming Reference

This document explains how event and parameter names in React Native SDK map to actual names sent to Facebook.

## Overview

Facebook SDK uses different naming conventions for events:
- **React Native SDK**: Uses PascalCase constants (e.g., `AppEventsLogger.AppEvents.CompletedRegistration`)
- **Actual Facebook Events**: Uses `fb_mobile_` prefix with snake_case (e.g., `fb_mobile_complete_registration`)
- **Custom Events**: Sent as-is without any prefix transformation

## Standard Events Mapping

| React Native SDK Constant | Actual Facebook Event Name | Description |
|---------------------------|----------------------------|-------------|
| `AppEventsLogger.AppEvents.AchievedLevel` | `fb_mobile_level_achieved` | Achievement of specific levels |
| `AppEventsLogger.AppEvents.AddedPaymentInfo` | `fb_mobile_add_payment_info` | Addition of customer payment info |
| `AppEventsLogger.AppEvents.AddedToCart` | `fb_mobile_add_to_cart` | Item added to shopping cart |
| `AppEventsLogger.AppEvents.AddedToWishlist` | `fb_mobile_add_to_wishlist` | Item added to wishlist |
| `AppEventsLogger.AppEvents.CompletedRegistration` | `fb_mobile_complete_registration` | User registration completion |
| `AppEventsLogger.AppEvents.CompletedTutorial` | `fb_mobile_tutorial_completion` | Tutorial completion |
| `AppEventsLogger.AppEvents.Contact` | `fb_mobile_contact` | Contact between customer and business |
| `AppEventsLogger.AppEvents.CustomizeProduct` | `fb_mobile_customize_product` | Product customization |
| `AppEventsLogger.AppEvents.Donate` | `fb_mobile_donate` | Donation to organization |
| `AppEventsLogger.AppEvents.FindLocation` | `fb_mobile_find_location` | Finding a location |
| `AppEventsLogger.AppEvents.InitiatedCheckout` | `fb_mobile_initiated_checkout` | Checkout process started |
| `AppEventsLogger.AppEvents.Purchased` | `fb_mobile_purchase` | Purchase completion |
| `AppEventsLogger.AppEvents.Rated` | `fb_mobile_rate` | Rating of content |
| `AppEventsLogger.AppEvents.Schedule` | `fb_mobile_schedule` | Booking an appointment |
| `AppEventsLogger.AppEvents.Searched` | `fb_mobile_search` | Search performed |
| `AppEventsLogger.AppEvents.SpentCredits` | `fb_mobile_spent_credits` | In-app credits spent |
| `AppEventsLogger.AppEvents.StartTrial` | `fb_mobile_start_trial` | Free trial started |
| `AppEventsLogger.AppEvents.SubmitApplication` | `fb_mobile_submit_application` | Application submission |
| `AppEventsLogger.AppEvents.Subscribe` | `fb_mobile_subscribe` | Paid subscription started |
| `AppEventsLogger.AppEvents.UnlockedAchievement` | `fb_mobile_achievement_unlocked` | Achievement unlocked |
| `AppEventsLogger.AppEvents.ViewedContent` | `fb_mobile_content_view` | Content page viewed |
| `AppEventsLogger.AppEvents.AdClick` | `fb_mobile_ad_click` | In-app ad clicked |
| `AppEventsLogger.AppEvents.AdImpression` | `fb_mobile_ad_impression` | In-app ad impression |

## Standard Event Parameters Mapping

| React Native SDK Constant | Client-Side Parameter | Server-Side Parameter | Description |
|---------------------------|----------------------|----------------------|-------------|
| `AppEventsLogger.AppEventParams.RegistrationMethod` | `fb_registration_method` | `registration_method` | Method of registration |
| `AppEventsLogger.AppEventParams.Description` | `fb_description` | `description` | String description |
| `AppEventsLogger.AppEventParams.ContentID` | `fb_content_id` | `content_id` | Product/content identifier |
| `AppEventsLogger.AppEventParams.ContentType` | `fb_content_type` | `content_type` | Type: 'product' or 'product_group' |
| `AppEventsLogger.AppEventParams.Content` | `fb_content` | `content` | JSON array of products |
| `AppEventsLogger.AppEventParams.Currency` | `fb_currency` | `currency` | ISO 4217 code (e.g., "USD") |
| `AppEventsLogger.AppEventParams.Level` | `fb_level` | `level` | Game level |
| `AppEventsLogger.AppEventParams.MaxRatingValue` | `fb_max_rating_value` | `max_rating_value` | Upper bound of rating scale |
| `AppEventsLogger.AppEventParams.NumItems` | `fb_num_items` | `num_items` | Number of items |
| `AppEventsLogger.AppEventParams.PaymentInfoAvailable` | `fb_payment_info_available` | `payment_info_available` | 1 for yes, 0 for no |
| `AppEventsLogger.AppEventParams.SearchString` | `fb_search_string` | `search_string` | Search query text |
| `AppEventsLogger.AppEventParams.Success` | `fb_success` | `success` | 1 for yes, 0 for no |
| `AppEventsLogger.AppEventParams.AddType` | `fb_ad_type` | `ad_type` | Type of ad |

### Parameter Naming Rules

**Client-Side (Mobile SDK)**:
- When using raw strings (not SDK constants), use `fb_` prefix: `fb_description`, `fb_content_id`
- Special parameter `_eventId` for deduplication (no prefix)

**Server-Side (Conversions API)**:
- Use plain snake_case names without `fb_` prefix: `description`, `content_id`
- Custom parameters can use any naming convention

## Custom Events

Custom events are sent to Facebook exactly as you name them, with **NO** prefix transformation:

```typescript
// Custom event - sent as "SecondChatMessage" (no fb_mobile_ prefix)
AppEventsLogger.logEvent('SecondChatMessage', params);
```

**Important**: 
- Maximum 1,000 unique event names per app
- Event names: 2-40 characters, alphanumeric + underscores/dashes
- Parameter names: up to 25 unique per event

## Examples from Our Codebase

### Example 1: Standard Event (Activate App)
```typescript
// React Native code
AppEventsLogger.logEvent(FB_MOBILE_ACTIVATE_APP, params);

// Sent to Facebook as:
// Event name: "fb_mobile_activate_app"
```

### Example 2: Standard Event (Complete Registration)
```typescript
// React Native code
const clientParams = { 
  _eventId: eventId,
  registration_method: 'email'  // Client-side parameter
};
AppEventsLogger.logEvent(FB_MOBILE_COMPLETE_REGISTRATION, clientParams);

// Sent to Facebook as:
// Event name: "fb_mobile_complete_registration"
// Parameters: { _eventId: "...", fb_registration_method: "email" }
```

### Example 3: Custom Event (Second Chat Message)
```typescript
// React Native code
AppEventsLogger.logEvent('SecondChatMessage', params);

// Sent to Facebook as:
// Event name: "SecondChatMessage" (exactly as written, no transformation)
```

## Native SDK Constants

### iOS (FBSDKAppEventName)
```objective-c
FBSDKAppEventNameAchievedLevel // → fb_mobile_level_achieved
FBSDKAppEventNameCompletedRegistration // → fb_mobile_complete_registration
FBSDKAppEventNameUnlockedAchievement // → fb_mobile_achievement_unlocked
// ... etc
```

### Android (AppEventsConstants)
```java
AppEventsConstants.EVENT_NAME_ACHIEVED_LEVEL // → fb_mobile_level_achieved
AppEventsConstants.EVENT_NAME_COMPLETED_REGISTRATION // → fb_mobile_complete_registration
AppEventsConstants.EVENT_NAME_UNLOCKED_ACHIEVEMENT // → fb_mobile_achievement_unlocked
// ... etc
```

## How SDK Works Internally

1. **React Native Layer**: You use `AppEventsLogger.AppEvents.CompletedRegistration` constant
2. **Native Bridge**: SDK passes this to native iOS/Android code
3. **Native SDK**: Native code has constants like:
   - iOS: `FBSDKAppEventNameCompletedRegistration = @"fb_mobile_complete_registration"`
   - Android: `EVENT_NAME_COMPLETED_REGISTRATION = "fb_mobile_complete_registration"`
4. **Facebook Server**: Receives event with name `"fb_mobile_complete_registration"`

## References

- [Facebook App Events Reference](https://developers.facebook.com/docs/app-events/reference)
- [Android SDK AppEventsConstants](https://developers.facebook.com/docs/reference/androidsdk/current/facebook/com/facebook/appevents/appeventsconstants.html/)
- [iOS SDK FBSDKAppEvents](https://developers.facebook.com/docs/reference/ios/current/class/FBSDKAppEvents)
- [React Native FBSDK Next](https://github.com/thebergamo/react-native-fbsdk-next)
