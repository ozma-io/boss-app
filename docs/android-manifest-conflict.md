# Android Manifest Conflict Resolution

## Problem

When building the Android app, a manifest merger conflict occurs between two libraries:
- `expo-notifications`
- `@react-native-firebase/messaging`

Both libraries define the same meta-data entry `com.google.firebase.messaging.default_notification_color` with different values:
- Our app (via `expo-notifications`): `@color/notification_icon_color` (#8BC34A - green)
- Firebase Messaging library: `@color/white` (default fallback)

This causes the build to fail with:

```
Manifest merger failed : Attribute meta-data#com.google.firebase.messaging.default_notification_color@resource 
value=(@color/notification_icon_color) from AndroidManifest.xml:24:88-137
is also present at [:react-native-firebase_messaging] AndroidManifest.xml:46:13-44 value=(@color/white).
Suggestion: add 'tools:replace="android:resource"' to <meta-data> element at AndroidManifest.xml:24:5-139 to override.
```

## Why Both Libraries?

We use a **hybrid approach** for push notifications:

### `expo-notifications` (Client-side)
- Requesting notification permissions from the user
- Creating Android notification channels
- Handling foreground notifications
- Setting notification handlers and behavior

### `@react-native-firebase/messaging` (Server-side)
- Getting FCM tokens from Firebase
- Sending push notifications from Cloud Functions (via Firebase Admin SDK)
- Handling background push notifications
- Token refresh listeners

This architecture is a **best practice** because:
- `expo-notifications` provides excellent cross-platform APIs for local notification handling
- `@react-native-firebase/messaging` provides direct FCM integration for server-to-device push
- Each library excels at its specific role

## Solution

The Android build system provides the `tools:replace` attribute to resolve such conflicts. We need to add it to our meta-data entry to tell Android: "use our app's value and ignore the library's default."

We use **two different approaches** depending on the build environment:

### 1. Local Development (Expo Prebuild)

**File:** `plugins/withNotificationManifestFix.js`

This Expo config plugin automatically adds:
- `xmlns:tools` namespace to the manifest root
- `tools:replace="android:resource"` attribute to the notification color meta-data

**Works when:**
- Running `npx expo prebuild --platform android` (without `--clean`)
- The manifest file already exists with meta-data entries

**Does NOT work when:**
- Running with `--clean` flag (deletes android/ folder first)
- On EAS Build (always uses `--clean`)

**Why the limitation?**
The plugin runs in two phases:
1. `withAndroidManifest` - modifies the XML object, but meta-data doesn't exist yet
2. `dangerousMod` - modifies the file directly, but runs before meta-data is added

The meta-data entries are added by `expo-notifications` plugin AFTER our plugin runs, so there's nothing to modify.

### 2. EAS Build (Production & CI)

**Files:** 
- `.eas/build/fix-android-manifest.sh` (bash script)
- `package.json` (EAS Build npm hook)

A bash script that runs via the `eas-build-post-install` npm hook AFTER all prebuild steps complete, including meta-data generation.

> 📘 **Note:** This uses [EAS Build npm hooks](https://docs.expo.dev/build-reference/npm-hooks/), the official mechanism for running custom scripts during the build lifecycle.

**How it works:**
1. EAS Build installs dependencies (`npm install`)
2. EAS Build runs `npx expo prebuild` (generates manifest with meta-data)
3. EAS automatically executes the `eas-build-post-install` hook from `package.json`
4. The hook runs the bash script to patch the manifest
5. Gradle build continues with the patched manifest

**Configuration in `package.json`:**
```json
{
  "scripts": {
    "eas-build-post-install": "bash .eas/build/fix-android-manifest.sh"
  }
}
```

**Why use `eas-build-post-install` hook?**
EAS Build provides [official npm hooks](https://docs.expo.dev/build-reference/npm-hooks/) for different build stages:
- `eas-build-pre-install` - runs before dependencies are installed
- **`eas-build-post-install`** - runs after dependencies are installed AND after prebuild

The `eas-build-post-install` hook is perfect for our use case because:
- It runs AFTER `npm install` completes
- It runs AFTER `expo prebuild` (manifest already exists with meta-data)
- It runs BEFORE Gradle compilation (can still modify the manifest)
- EAS doesn't add extra arguments like `--platform` to hooks (unlike `prebuildCommand`)

**No configuration needed in `eas.json`** - EAS automatically detects and runs the hook!

The bash script:
- Checks `$EAS_BUILD_PLATFORM` environment variable (only runs for Android)
- Adds `xmlns:tools="http://schemas.android.com/tools"` to manifest root
- Adds `tools:replace="android:resource"` to the notification color meta-data
- Handles errors gracefully and provides clear output
- Skips execution on iOS builds (exits with code 0)

## Technical Details

### The `tools:replace` Attribute

From [Android documentation](https://developer.android.com/studio/build/manifest-merge):

> When two manifest files have the same attribute with different values, the manifest merger follows the priority order and uses the attribute from the higher-priority manifest. Use `tools:replace` to explicitly declare which attribute value should be used.

**Result in AndroidManifest.xml:**
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android" 
          xmlns:tools="http://schemas.android.com/tools">
  <application>
    <meta-data 
      android:name="com.google.firebase.messaging.default_notification_color" 
      android:resource="@color/notification_icon_color"
      tools:replace="android:resource"/>
  </application>
</manifest>
```

## Files Involved

| File | Purpose |
|------|---------|
| `plugins/withNotificationManifestFix.js` | Config plugin for local development |
| `.eas/build/fix-android-manifest.sh` | Bash script that fixes the manifest |
| `package.json` | Contains `eas-build-pre-compile` hook for EAS Build |
| `app.config.ts` | Includes the config plugin in plugins array |
| `android/app/src/main/AndroidManifest.xml` | Generated file (not committed to git) |

## Verification

After running either `npx expo prebuild` or an EAS Build, check that the manifest has:

```bash
# Check for tools namespace
grep 'xmlns:tools' android/app/src/main/AndroidManifest.xml

# Check for tools:replace attribute
grep 'tools:replace="android:resource"' android/app/src/main/AndroidManifest.xml
```

## Alternative Approaches Considered

### ❌ Removing `expo-notifications`
- Would lose excellent cross-platform APIs for notification handling
- Would need to implement Android channels, handlers manually
- Not recommended; both libraries serve different purposes

### ❌ Removing `@react-native-firebase/messaging`
- Would lose direct FCM integration
- Would need to use Expo Push Notification Service (adds dependency)
- Would require rewriting Cloud Functions to use Expo API
- Not recommended; direct FCM is more flexible

### ❌ Committing `android/` folder to git
- Goes against Expo CNG (Continuous Native Generation) philosophy
- Would require manual maintenance of native code
- Config plugins wouldn't work properly
- Not recommended for Expo projects

### ✅ Prebuild Hook (Current Solution)
- Works reliably for EAS Build
- Minimal code, easy to maintain
- Follows official Android guidance (`tools:replace`)
- Documented and transparent

## References

- [Android Manifest Merger Documentation](https://developer.android.com/studio/build/manifest-merge)
- [Expo Config Plugins](https://docs.expo.dev/config-plugins/introduction/)
- [EAS Build npm Hooks](https://docs.expo.dev/build-reference/npm-hooks/) - Official documentation for lifecycle hooks
- [EAS Build Configuration](https://docs.expo.dev/build/eas-json/)
- [Firebase Messaging Setup](https://rnfirebase.io/messaging/usage)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)

