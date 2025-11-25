# Notification System

## Overview

The notification system supports multiple channels (email + push notifications) for proactive user engagement. It consists of:

- **Python Orchestrator** - Scheduled function that decides who needs notifications
- **Email Operations** - Firestore subcollection tracking email lifecycle
- **TypeScript Triggers** - Functions that send emails via Mailgun
- **Chat Integration** - Reuses existing `chatThreads/messages` for notification content

## Architecture

### Data Flow

1. **Cloud Scheduler** triggers Python orchestrator every 2 hours
2. **Orchestrator** queries users and decides who needs notifications
3. **Creates messages** in `users/{userId}/chatThreads/{threadId}/messages` (semantic content)
4. **Creates email operations** in `users/{userId}/emails/{emailId}` with `state: 'PLANNED'`
5. **TypeScript trigger** detects new email document, sends via Mailgun
6. **Updates state** to 'SENT' or 'FAILED' in same document

### Firestore Structure

```
/users/{userId}
  ├── email_unsubscribed: boolean
  ├── notification_state:
  │   └── last_notification_at: string (ISO 8601)
  ├── chatThreads/{threadId}/
  │   └── messages/{messageId}/      # Notification content (semantic)
  └── emails/{emailId}/               # Email operations (transport)
      ├── to: string
      ├── subject: string
      ├── body_text: string
      ├── state: 'PLANNED' | 'SENDING' | 'SENT' | 'FAILED'
      ├── sentAt?: string
      ├── lastErrorMessage?: string
      └── createdAt: string
```

## Setup Instructions

### 1. Install Dependencies

```bash
# TypeScript functions
cd functions
npm install

# Python functions
cd ../functions-python
pip install -r requirements.txt
```

### 2. Configure Mailgun API Key

**Step 1: Get your Mailgun API Key**

1. Go to [Mailgun Dashboard](https://app.mailgun.com/)
2. Log in to your account
3. Click **"API Keys"** in the left sidebar (or go to Settings → API Keys)
4. Find your **Private API key** (starts with `key-...`)
5. Copy the key

**Step 2: Add secret to Firebase**

Use Firebase CLI to add the Mailgun API key to Secret Manager:

```bash
# Add Mailgun API key secret
firebase functions:secrets:set MAILGUN_API_KEY
# Paste your key when prompted, then press Enter

# Verify it was created
firebase functions:secrets:access MAILGUN_API_KEY
```

**Important:** 
- Firebase automatically handles secrets - no need to grant IAM permissions manually
- The `defineSecret` API in code ensures the secret is trimmed and properly injected
- Never commit API keys to git!

### 3. Deploy Functions

```bash
# Deploy all functions (TypeScript + Python)
firebase deploy --only functions
```

**How it works:**
- Firebase CLI automatically detects both directories:
  - TypeScript functions in `functions/`
  - Python functions in `functions-python/`
- Both deploy together with a single command
- No additional configuration needed

**Note:** This project uses manual deployment via Firebase CLI. No GitHub Actions/workflows are configured. See `docs/firebase-deployment.md` for full deployment guide.

### 4. Setup Cloud Scheduler

**IMPORTANT:** Cloud Scheduler must be configured **once** after first deployment. This is a manual one-time setup that creates the "pinger" to trigger the orchestrator every 2 hours.

#### Via gcloud CLI (Recommended)

Create the scheduler job with this command:

```bash
# Replace YOUR-PROJECT with your Firebase project ID (e.g., the-boss-app-e42b6)
PROJECT_ID="YOUR-PROJECT"

gcloud scheduler jobs create http notification-orchestrator \
  --location=us-central1 \
  --schedule="0 */2 * * *" \
  --uri="https://us-central1-${PROJECT_ID}.cloudfunctions.net/notificationOrchestrator" \
  --http-method=GET \
  --oidc-service-account-email=${PROJECT_ID}@appspot.gserviceaccount.com \
  --time-zone="UTC"
```

**Verify it was created:**

```bash
gcloud scheduler jobs list --location=us-central1
```

**Test it manually:**

```bash
gcloud scheduler jobs run notification-orchestrator --location=us-central1
```

#### Via Google Cloud Console (Alternative)

1. Go to [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler)
2. Click **Create Job**
3. Configure:
   - **Name:** `notification-orchestrator`
   - **Region:** `us-central1`
   - **Frequency:** `0 */2 * * *` (every 2 hours)
   - **Timezone:** `UTC`
   - **Target type:** HTTP
   - **URL:** `https://us-central1-YOUR-PROJECT.cloudfunctions.net/notificationOrchestrator`
   - **HTTP Method:** GET
   - **Auth header:** Add OIDC token
   - **Service Account:** `YOUR-PROJECT@appspot.gserviceaccount.com`
4. Click **Create**

#### Schedule Explanation

- `0 */2 * * *` = Every 2 hours at :00 (00:00, 02:00, 04:00, etc.)
- Timezone: UTC
- First run: Next :00 hour after creation

### 5. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

## Configuration

### Mailgun Settings

Configured in `functions/src/constants.ts`:

```typescript
export const MAILGUN_CONFIG = {
  apiKey: process.env.MAILGUN_API_KEY || '', // From Secret Manager
  domain: 'mg.ozma.io', // Hardcoded, not a secret
  from: 'BossUp <bossup@ozma.io>',
};
```

### User Notification Settings

Stored in user document:

```typescript
{
  email_unsubscribed: false, // Set to true if user unsubscribes via Mailgun
  notification_state: {
    last_notification_at: "2025-11-22T10:00:00Z"
  }
}
```

## Testing

### Manual Email Test

Create an email document manually in Firestore Console:

```javascript
// Path: users/{userId}/emails/{emailId}
{
  to: "test@example.com",
  subject: "Test Notification",
  body_text: "This is a test email from the notification system.",
  state: "PLANNED",
  createdAt: "2025-11-22T10:00:00Z"
}
```

The TypeScript trigger will automatically:
1. Detect the new document
2. Send email via Mailgun
3. Update `state` to 'SENT' (or 'FAILED' if error)

### Test Python Orchestrator

Trigger the function manually:

```bash
# Via gcloud CLI
gcloud functions call notificationOrchestrator --region=us-central1

# Via curl
curl "https://us-central1-YOUR-PROJECT.cloudfunctions.net/notificationOrchestrator"
```

Check logs:

```bash
# TypeScript functions
firebase functions:log --only functions:onEmailCreated

# Python function
firebase functions:log --only functions:notificationOrchestrator
```

### Test Cloud Scheduler

Run the job manually:

```bash
gcloud scheduler jobs run notification-orchestrator --location=us-central1
```

## Notification Scenarios

Currently, the orchestrator contains stub logic. Notification scenarios to be implemented:

- **Onboarding reminder** - Complete profile, add first boss
- **Weekly check-in** - "How's your week going?"
- **N-day silence** - Haven't used app in X days
- **Check-in with boss** - Based on timeline events

Implementation location: `functions-python/main.py`

## Email Unsubscribe Handling

Users can unsubscribe via Mailgun's built-in unsubscribe link (automatically added to emails).

### Future Enhancement: Mailgun Webhook

To automatically update `email_unsubscribed` field:

1. Create webhook in Mailgun dashboard
2. Add Cloud Function endpoint to handle webhook events
3. Update user document when unsubscribe event received

```typescript
// Future: functions/src/mailgun-webhook.ts
export const mailgunWebhook = onRequest(async (req, res) => {
  const event = req.body;
  if (event.event === 'unsubscribed') {
    const email = event.recipient;
    // Find user by email and set email_unsubscribed = true
  }
});
```

## Monitoring

### Check Email Status

Query Firestore to see email operations:

```javascript
// Get all emails for a user
db.collection('users').doc(userId).collection('emails').get()

// Filter by state
db.collection('users').doc(userId).collection('emails')
  .where('state', '==', 'FAILED')
  .get()
```

### Check Function Logs

```bash
# All functions
firebase functions:log

# Specific function
firebase functions:log --only functions:onEmailCreated
firebase functions:log --only functions:notificationOrchestrator
```

### Mailgun Dashboard

View sent emails, delivery rates, and bounces at: https://app.mailgun.com/

## Troubleshooting

### Emails not sending

1. Check email document state in Firestore
2. Check function logs: `firebase functions:log --only functions:onEmailCreated`
3. Verify Mailgun API key in Secret Manager
4. Check Mailgun domain verification

### Python orchestrator not running

1. Verify Cloud Scheduler job exists: `gcloud scheduler jobs list --location=us-central1`
2. Check job status: `gcloud scheduler jobs describe notification-orchestrator --location=us-central1`
3. Run manually: `gcloud scheduler jobs run notification-orchestrator --location=us-central1`
4. Check logs: `firebase functions:log --only functions:notificationOrchestrator`

### Firestore permission errors

1. Verify rules deployed: `firebase deploy --only firestore:rules`
2. Check rules in Firestore Console
3. Test rules with Firestore Emulator

## Future Enhancements

- **Push notifications** - Integrate with existing FCM setup
- **Mailgun webhook** - Auto-update unsubscribe status
- **LLM-generated content** - Personalized email copy
- **Notification preferences** - User-configurable channels and frequency
- **A/B testing** - Test different notification scenarios
- **Analytics** - Track open rates, click rates, conversions

