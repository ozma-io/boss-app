# Intercom Access Token Setup

## Overview

The `INTERCOM_ACCESS_TOKEN` is required for the account deletion Cloud Function to delete users from Intercom when they delete their account.

## Step 1: Get Intercom Access Token

1. Go to **Intercom Settings** → **Developers** → **Developer Hub**
2. Navigate to **Your Apps** → Select your app (`xpq2wx7a`)
3. Go to **Authentication** → **Access Tokens**
4. Click **New Access Token**
5. Name it: `Account Deletion API`
6. Permissions required:
   - **Read contacts** (`contacts.read`)
   - **Write contacts** (`contacts.write`)
7. Copy the generated token (starts with `dG9r...`)

## Step 2: Add to Firebase Secret Manager

### Option A: Using Firebase Console (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **BossUp**
3. Go to **Build** → **Functions**
4. Click on **Secrets** tab
5. Click **Add a Secret**
6. Name: `INTERCOM_ACCESS_TOKEN`
7. Value: Paste the access token from Step 1
8. Click **Save**

### Option B: Using Firebase CLI

```bash
# From the project root directory
firebase functions:secrets:set INTERCOM_ACCESS_TOKEN

# Paste the token when prompted
# Press Enter to confirm
```

## Step 3: Deploy Cloud Functions

After adding the secret, redeploy the Cloud Functions:

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

## Verification

To verify the setup is working:

1. Test account deletion in the app
2. Check Firebase Functions logs:
   ```bash
   firebase functions:log --only deleteUserAccount
   ```
3. Look for log messages:
   - `"Attempting to delete user from Intercom"`
   - `"Successfully deleted user from Intercom"`

## Security Notes

- ⚠️ **NEVER commit the access token to git**
- ✅ The token is stored securely in Firebase Secret Manager
- ✅ Only Cloud Functions with `secrets: [intercomAccessToken]` can access it
- ✅ Token has minimal permissions (only contacts read/write)

## Troubleshooting

### Error: "Intercom access token not configured"
- The secret is not set in Firebase Secret Manager
- Run Step 2 again to add the secret

### Error: "Failed to find Intercom contact"
- Normal if user never opened Intercom in the app
- The deletion will continue successfully (this is expected behavior)

### Error: "Failed to delete contact: 401"
- The access token is invalid or expired
- Generate a new token in Intercom and update the secret

### Error: "Failed to delete contact: 403"
- The access token doesn't have required permissions
- Check that `contacts.write` permission is granted in Intercom

