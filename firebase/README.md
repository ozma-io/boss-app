# Firebase Configuration Files

Place your Firebase configuration files here:

## Required Files

### Android
- **File:** `google-services.json`
- **Download from:** [Firebase Console](https://console.firebase.google.com/) → Project Settings → Your Apps → Android app → Download `google-services.json`
- **Place in:** `firebase/google-services.json`

### iOS
- **File:** `GoogleService-Info.plist`
- **Download from:** [Firebase Console](https://console.firebase.google.com/) → Project Settings → Your Apps → iOS app → Download `GoogleService-Info.plist`
- **Place in:** `firebase/GoogleService-Info.plist`

## ✅ Safe to Commit

These files can be safely committed to git. They contain:
- ✅ Public API keys (protected by Firebase Security Rules)
- ✅ App identifiers
- ❌ NO secrets or private keys

Firebase documentation confirms these files are safe to commit for mobile apps.

## Next Steps

After adding the files:

1. Run prebuild:
   ```bash
   npx expo prebuild --clean
   ```

2. Run the app:
   ```bash
   npm run ios
   # or
   npm run android
   ```

