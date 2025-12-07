# Subscriptions & In-App Purchases (IAP)

Complete guide for Apple and Google in-app purchase integration.

---

## ⚠️ Library Version Notice

**Current Version:** `react-native-iap@14.4.12` (locked)

**Technical Issue:** Versions 14.4.35+ have a breaking API incompatibility between `react-native-iap` and `openiap` library:

- **Broken code (14.4.35+):** 
  ```swift
  let props = try OpenIapSerialization.receiptValidationProps(from: ["sku": params.sku])
  // Error: 'OpenIapSerialization' has no member 'receiptValidationProps'
  ```
- **Root cause:** openiap 1.2.36+ removed the `receiptValidationProps` method, but react-native-iap code wasn't updated
- **Working version (14.4.12):** Uses openiap 1.2.10 where the method still exists

**Version History:**
| react-native-iap | openiap | Status |
|------------------|---------|--------|
| 14.4.12 | 1.2.10 | ✅ Works |
| 14.4.35-14.4.44 | 1.2.36 | ❌ Broken |
| 14.4.46 | 1.2.39 | ❌ Broken |

**When to update:**
- Monitor [react-native-iap releases](https://github.com/hyochan/react-native-iap/releases)
- Check if `receiptValidationProps` issue is fixed in newer versions
- Test EAS build before releasing to production
- Consider reporting issue to maintainers if not already filed

**Note:** We don't actually use `validateReceipt` in our app (server-side verification only), but the code must compile for iOS build to succeed.

---

## 📋 Overview

BossUp uses native in-app purchases for subscriptions on mobile platforms:

- **iOS:** Apple In-App Purchase (active)
- **Android:** Google Play Billing (active)
- **Web:** Stripe (handled separately, not in this doc)

**Key Features:**
- Native subscription purchase flow
- Server-side receipt verification
- Automatic Stripe-to-IAP migration for existing users
- Auto-sync subscription status on app launch
- Seamless cross-platform subscription access

---

## 🏗️ Architecture

### Client-Side (`services/iap.service.ts`)

**Main Functions:**

1. **`initializeIAP()`** - Initialize IAP connection (called on app startup)
2. **`purchaseSubscription(productId, tier, billingPeriod)`** - Purchase flow
3. **`checkAndSyncSubscription(userId)`** - Sync device subscription with Firestore
4. **`endIAPConnection()`** - Cleanup (called on app shutdown)

**Flow:**
```
User taps "Subscribe" 
  → requestPurchase() via react-native-iap
  → Get receipt (purchaseToken/JWS)
  → Call Cloud Function verifyIAPPurchase()
  → Update Firestore
  → Show success/error
```

### Server-Side (`functions/src/iap-verification.ts`)

**Main Cloud Function:** `verifyIAPPurchase`

**What it does:**
1. Verify receipt with Apple App Store Server API
2. Check if user has Stripe subscription → cancel it automatically
3. Update user subscription in Firestore
4. Return verification result

**Security:**
- Requires user authentication (`request.auth`)
- All secrets stored in Firebase Secret Manager
- Receipt validation with Apple/Google official APIs

---

## 🚀 Setup

### 1. App Store Connect Setup

**Create Subscriptions:**

1. Go to: App Store Connect → Your App → Subscriptions
2. Create Subscription Group: **"BossUp Premium"**
3. Create 4 auto-renewable subscriptions:

| Product ID | Display Name | Billing Period |
|------------|--------------|----------------|
| `com.ozmaio.bossup.basic.monthly` | Basic Monthly | 1 month |
| `com.ozmaio.bossup.basic.quarterly` | Basic Quarterly | 3 months |
| `com.ozmaio.bossup.basic.semiannual` | Basic Semi-Annual | 6 months |
| `com.ozmaio.bossup.basic.annual` | Basic Annual | 1 year |

> **Note:** See `constants/subscriptionPlans.ts` for current pricing and trial details.

**Create API Key:**

1. App Store Connect → Users and Access → Keys → In-App Purchase
2. Create API Key → Download `.p8` file
3. Save these values:
   - Key ID
   - Issuer ID
   - Private Key content (from .p8 file)

**Configure Server Notifications:**

Set up Server-to-Server notifications to receive real-time updates about subscription changes:

1. **Direct Link:** [https://appstoreconnect.apple.com/apps](https://appstoreconnect.apple.com/apps)
2. Navigate: **Apps → Your App (BossUp) → General → App Information**
3. Scroll down to **"App Store Server Notifications"** section
4. Enter the webhook URL in **both** fields:
   - **Production Server URL:** `https://us-central1-the-boss-app-e42b6.cloudfunctions.net/appleServerNotification`
   - **Sandbox Server URL:** `https://us-central1-the-boss-app-e42b6.cloudfunctions.net/appleServerNotification`
5. Click **Save**
6. Apple will send a test notification to verify the endpoint

> **Note:** Use the same URL for both environments - the Cloud Function automatically detects sandbox vs production.
> 
> **Events Tracked:** Subscription renewals, cancellations, refunds, billing issues, grace periods, and more.
> 
> **Monitoring:** Check logs with `firebase functions:log --only appleServerNotification`

**Sandbox Testing:**

1. Settings → Users and Access → Sandbox Testers
2. Create test Apple IDs for development

### 2. Google Play Console Setup

**Create Subscriptions:**

1. Go to: Google Play Console → Your App → Monetize → Subscriptions
2. Create subscription products:

| Product ID | Display Name | Billing Period |
|------------|--------------|----------------|
| `play_basic:monthly` | Basic Monthly | 1 month |
| `play_basic:quarterly` | Basic Quarterly | 3 months |
| `play_basic:semiannual` | Basic Semi-Annual | 6 months |
| `play_basic:annual` | Basic Annual | 1 year |

> **Note:** Product IDs must match those in `constants/subscriptionPlans.ts` (googlePlayProductId field).

**Create Service Account:**

1. **Create Project in Google Cloud Platform:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project or select existing project linked to your app

2. **Enable Google Play Developer API:**
   - In Google Cloud Console → APIs & Services → Library
   - Search for "Google Play Developer API"
   - Click "Enable"

3. **Create Service Account:**
   - In Google Cloud Console → IAM & Admin → Service Accounts
   - Click "Create Service Account"
   - Name: `firebase-iap-verification` (or any name)
   - Click "Create and Continue"
   - Skip optional steps and click "Done"

4. **Create Service Account Key:**
   - Click on the newly created service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Select "JSON" format
   - Download the JSON key file (keep it secure!)

5. **Grant Access in Google Play Console:**
   - Go to [Google Play Console](https://play.google.com/console/)
   - Settings → Developer account → API access
   - Under "Service accounts", find your service account
   - Click "Grant access"
   - Select permissions:
     - View financial data
     - Manage orders and subscriptions
   - Click "Invite user"

**License Testing:**

1. Google Play Console → Settings → License testing
2. Add test Gmail accounts that can make test purchases
3. Test purchases are free for license testers

### 3. Firebase Secrets Setup

Set secrets for Cloud Functions:

```bash
# Apple App Store Private Key
firebase functions:secrets:set APPLE_APP_STORE_PRIVATE_KEY
# Paste entire content of .p8 file (including header/footer)

# Google Service Account Key
firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT_KEY
# Paste entire content of JSON key file from Google Cloud Console

# Stripe (for migration handling)
firebase functions:secrets:set STRIPE_SECRET_KEY
# Enter your Stripe secret key (sk_live_...)
```

### 4. Deploy Cloud Function

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions:verifyIAPPurchase
```

### 5. Verify Remote Config

Product IDs must match in Remote Config:

```json
{
  "subscriptionPlans": [
    {
      "tier": "basic",
      "billingPeriod": "monthly",
      "appleProductId": "com.ozmaio.bossup.basic.monthly",
      "googlePlayProductId": "play_basic:monthly",
      ...
    }
  ]
}
```

---

## 🧪 Testing

### iOS Sandbox Testing

**Setup:**

1. **Create Sandbox Tester:**
   - App Store Connect → Users and Access → Sandbox Testers
   - Create test Apple ID (e.g., `test@example.com`)

2. **Sign Out of Production Apple ID:**
   - Settings → App Store → Sign Out

3. **Don't Sign In Yet!** iOS will prompt when you make first purchase.

**Test Purchase Flow:**

1. Open app → Navigate to Subscription screen
2. Select a plan → Tap "Subscribe"
3. iOS will prompt for Apple ID
4. Sign in with your **Sandbox Tester** credentials
5. Confirm purchase (no real charge)
6. Verify subscription appears in app

**Important:**
- Sandbox subscriptions expire much faster (1 hour = 5 minutes in sandbox)
- Maximum 6 auto-renewals in sandbox
- Use different sandbox accounts for different test scenarios

**Reset Sandbox:**

To test fresh installs:
1. App Store Connect → Sandbox Testers → Delete tester
2. Recreate same tester email
3. Or: Create new sandbox tester

### Android Testing

**Setup:**

1. **Add License Testers:**
   - Google Play Console → Settings → License testing
   - Add Gmail accounts (e.g., `test@gmail.com`)
   - These accounts can make test purchases without real charges

2. **Internal Testing Track:**
   - Build a signed release APK/AAB
   - Upload to Play Console → Testing → Internal testing
   - Add testers to the internal testing list
   - Testers receive email invitation

3. **Important Notes:**
   - Must use signed build (not debug builds)
   - Must be uploaded to Play Console (internal testing minimum)
   - Testers must opt-in via invitation link
   - Test purchases are free for license testers

**Test Purchase Flow:**

1. Install app from internal testing track
2. Open app → Navigate to Subscription screen
3. Select a plan → Tap "Subscribe"
4. Google Play payment dialog appears
5. Confirm purchase (no real charge for license testers)
6. Verify subscription appears in app

**Test Environment:**

- Test purchases behave like real subscriptions but are free
- Auto-renewal works (but can be quickly cancelled)
- Can test upgrades, downgrades, cancellations
- Subscriptions can be managed in Google Play app → Subscriptions

**Pending Purchases:**

Android supports pending purchases for certain payment methods (e.g., bank transfers):
- Purchase stays in "pending" state until payment clears
- App shows appropriate message to user
- Backend verifies purchase status when payment completes

### Check Subscription Status

**Firestore:**
```
/users/{userId}/subscription
  - status: "active" | "trial" | "expired" | "cancelled" | "pending"
  - provider: "apple" | "google" | "stripe"
  - tier: "basic"
  - billingPeriod: "monthly" | "quarterly" | "semiannual" | "annual"
  - currentPeriodStart: ISO timestamp
  - currentPeriodEnd: ISO timestamp
  
  // Apple-specific fields
  - appleOriginalTransactionId: "..."
  - appleProductId: "com.ozmaio.bossup.basic.monthly"
  - appleEnvironment: "Sandbox" | "Production"
  
  // Google-specific fields
  - googlePurchaseToken: "..."
  - googleProductId: "play_basic:monthly"
  - googlePackageName: "com.ozmaio.bossup"
```

**Cloud Function Logs:**
```bash
firebase functions:log --only verifyIAPPurchase
```

---

## 🔄 Stripe-to-IAP Migration

**Automatic Migration:**

When a user with an active Stripe subscription purchases via Apple IAP:

1. User makes Apple purchase
2. Cloud Function verifies receipt
3. **Automatically cancels Stripe subscription** (if exists)
4. Updates Firestore to use Apple subscription
5. User never knows migration happened

**Migration Fields in Firestore:**
```
/users/{userId}/subscription
  - migratedFrom: "stripe"
  - migratedAt: timestamp
```

**Important:**
- Migration is one-way (Stripe → IAP)
- Previous Stripe subscription is cancelled immediately
- No pro-rating or refunds (handle separately if needed)
- User keeps subscription through current period end

---

## ❌ Manual Subscription Cancellation

**Overview:**

Users can manually cancel their subscriptions from the Subscription screen. The cancellation flow differs by provider:

### Apple & Google Subscriptions

- **Method:** Redirect to native Settings
- **Apple:** Settings → [Your Name] → Subscriptions → BossUp
- **Google:** Google Play Store app → Subscriptions
- **Reason:** Required by Apple/Google store policies - must use native cancellation

### Stripe Subscriptions

- **Method:** In-app cancellation via Cloud Function
- **Flow:**
  1. User taps "Cancel Subscription" button
  2. Confirmation dialog appears (no mention of "Stripe" for compliance)
  3. User confirms cancellation
  4. `cancelSubscription` Cloud Function is called
  5. Subscription status updated to 'cancelled' in Firestore
  6. User retains access until current period ends

**Cloud Function:** `cancelSubscription`
- **Location:** `functions/src/iap-verification.ts`
- **Authentication:** Required (user must be authenticated)
- **Permissions:** User can only cancel their own subscription
- **Response:** `{ success: boolean, currentPeriodEnd?: string, error?: string }`

**Firestore Updates:**
```
/users/{userId}/subscription
  - status: "cancelled"
  - cancelledAt: timestamp
  - cancellationReason: "user_request"
  - updatedAt: timestamp
```

**Compliance Notes:**
- No mention of "Stripe" in user-facing UI on mobile platforms
- Generic terminology: "your subscription", "billing period"
- Stripe references only in logs and analytics (not visible to Apple/Google)

**Amplitude Events:**
- `subscription_cancel_clicked` - Cancel button tapped
- `subscription_cancel_confirmed` - Confirmation dialog shown (Stripe only)
- `subscription_cancel_dismissed` - User chose to keep subscription
- `subscription_cancel_success` - Cancellation completed successfully
- `subscription_cancel_failed` - Cancellation failed (error)
- `subscription_cancel_error` - Unexpected error occurred

---

## 📱 Platform Support

### iOS (Active)
- ✅ Apple In-App Purchase via `react-native-iap`
- ✅ Receipt verification via Apple App Store Server API
- ✅ Sandbox and production environments
- ✅ Auto-sync on app launch

### Android (Active)
- ✅ Google Play Billing via `react-native-iap`
- ✅ Receipt verification via Google Play Developer API v3
- ✅ License testing for development
- ✅ Auto-sync on app launch
- ✅ Pending purchase support

### Web
- ℹ️ Uses Stripe (separate implementation)
- ℹ️ Not covered in this document

---

## 🔧 Troubleshooting

### Purchase Fails with "Invalid Product"

**Cause:** Product ID not found in App Store Connect

**Fix:**
1. Verify product exists in App Store Connect
2. Check product ID matches exactly (case-sensitive)
3. Ensure product is in "Ready to Submit" state
4. Wait 24 hours after creating product (can take time to propagate)

### Subscription Not Syncing

**Cause:** Auto-sync disabled or connection issue

**Fix:**
1. Check `checkAndSyncSubscription()` is called on screen focus
2. Verify IAP connection is initialized: `initializeIAP()`
3. Check device has active subscription: Settings → Apple ID → Subscriptions

### Sandbox Subscription Expired Immediately

**Cause:** Sandbox subscriptions have accelerated expiration

**Duration Mapping:**
- 3 days → 2 minutes
- 1 week → 3 minutes
- 1 month → 5 minutes
- 2 months → 10 minutes
- 3 months → 15 minutes
- 6 months → 30 minutes
- 1 year → 1 hour

**Fix:** This is expected behavior in sandbox. Test renewal flow quickly.

### Android: Product Not Found

**Cause:** Product not configured properly or app not uploaded to Play Console

**Fix:**
1. Verify product exists in Play Console → Monetize → Subscriptions
2. Ensure product is "Active" status
3. Upload signed build to internal testing track minimum
4. Wait 2-24 hours for products to propagate
5. Verify product ID matches exactly (case-sensitive)

### Android: No Offer Token Available

**Cause:** Subscription missing base plan or offers

**Fix:**
1. Go to Play Console → Monetize → Subscriptions → Your subscription
2. Ensure base plan is created and active
3. Add at least one offer (can be default pricing)
4. Save and wait for changes to propagate

### Android: License Error

**Cause:** Service account not configured or lacks permissions

**Fix:**
1. Verify Service Account created in Google Cloud Console
2. Verify Google Play Developer API is enabled
3. Check Service Account has access in Play Console → API access
4. Ensure permissions include "View financial data" and "Manage orders and subscriptions"
5. Re-download JSON key and update Firebase secret

---

## 📊 Key Files

**Frontend:**
- `app/subscription.tsx` - Subscription screen UI (includes cancellation)
- `services/iap.service.ts` - IAP SDK integration
- `types/index.ts` - TypeScript types

**Backend:**
- `functions/src/iap-verification.ts` - Receipt verification & cancellation
- `functions/src/index.ts` - Export Cloud Functions

**Config:**
- `constants/subscriptionPlans.ts` - Plan definitions
- `remoteconfig.template.json` - Remote Config template

**Cloud Functions:**
- `verifyIAPPurchase` - Verify Apple/Google receipts
- `cancelSubscription` - Cancel Stripe subscriptions manually

---

## 🔐 Security

**Client-Side:**
- ❌ No sensitive data in app bundle
- ❌ No Stripe SDK (Apple/Google compliance)
- ✅ All purchases verified server-side
- ✅ Receipts sent to Cloud Functions for verification

**Server-Side:**
- ✅ Secrets stored in Firebase Secret Manager
- ✅ User authentication required
- ✅ Official Apple/Google APIs for verification
- ✅ Automatic receipt validation

**Important:**
- Never trust client-side subscription status
- Always verify receipts server-side
- Store subscription data in Firestore (authoritative)

---

## 📚 Additional Resources

**Apple:**
- [App Store Server API Documentation](https://developer.apple.com/documentation/appstoreserverapi)
- [In-App Purchase Programming Guide](https://developer.apple.com/in-app-purchase/)
- [Testing In-App Purchases](https://developer.apple.com/documentation/storekit/in-app_purchase/testing_in-app_purchases)

**react-native-iap:**
- [Documentation](https://react-native-iap.dooboolab.com/)
- [GitHub Repository](https://github.com/dooboolab/react-native-iap)

**Related Docs:**
- [Firebase Deployment](./firebase-deployment.md) - Secrets setup
- [Firestore Management](./firestore-management.md) - Subscription schema

---

## 🆘 Need Help?

**Check logs:**
```bash
# Cloud Function logs
firebase functions:log --only verifyIAPPurchase

# App logs (logger.service.ts)
# Open app → Check Xcode console for IAP logs
```

**Common issues:**
1. Product ID mismatch → Check Remote Config and App Store Connect
2. Secrets not set → Run `firebase functions:secrets:set ...`
3. Sandbox tester issues → Sign out of production Apple ID first
4. Receipt invalid → Ensure using correct environment (Sandbox/Production)

For more help, see implementation in `services/iap.service.ts` and `functions/src/iap-verification.ts`.

