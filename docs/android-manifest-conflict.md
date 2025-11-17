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
- `package.json` (npm script wrapper)
- `eas.json` (build configuration)

A bash script that runs as a `prebuildCommand` in `eas.json` AFTER all prebuild steps complete, including meta-data generation.

**How it works:**
1. EAS Build runs `npx expo prebuild` (generates manifest with meta-data)
2. EAS executes the `prebuildCommand`: `npm run fix-android-manifest`
3. The npm script calls the bash script to patch the manifest
4. Gradle build continues with the patched manifest

**Configuration in `package.json`:**
```json
{
  "scripts": {
    "fix-android-manifest": "bash .eas/build/fix-android-manifest.sh"
  }
}
```

**Configuration in `eas.json`:**
```json
{
  "build": {
    "production": {
      "android": {
        "prebuildCommand": "npm run fix-android-manifest"
      }
    }
  }
}
```

**Why npm script?**
EAS Build automatically prepends `npx expo` to any command in `prebuildCommand`. Using `npm run` allows the command to execute correctly as `npx expo npm run fix-android-manifest`, which properly delegates to our bash script.

The bash script:
- Adds `xmlns:tools="http://schemas.android.com/tools"` to manifest root
- Adds `tools:replace="android:resource"` to the notification color meta-data
- Handles errors gracefully and provides clear output

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
| `package.json` | npm script wrapper for EAS Build |
| `eas.json` | Configures prebuild hook for all Android profiles |
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
- [EAS Build Configuration](https://docs.expo.dev/build/eas-json/)
- [Firebase Messaging Setup](https://rnfirebase.io/messaging/usage)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)

