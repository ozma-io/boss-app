# Troubleshooting iOS Pod Install Issues

Last updated: November 14, 2025

## RCT-Folly Dependency Error with New Architecture

### Problem

When running `pod install` in the `ios/` directory, you may encounter the following error:

```
[!] Unable to find a specification for `RCT-Folly` depended upon by `RNIap`

You have either:
 * out-of-date source repos which you can update with `pod repo update` or with `pod install --repo-update`.
 * mistyped the name or version.
 * not added the source repo that hosts the Podspec to your Podfile.
```

### Root Cause

This error occurs when using **New Architecture** (`newArchEnabled: true`) with **prebuilt React Native artifacts**. The `react-native-iap` library requires `RCT-Folly` and other dependencies when New Architecture is enabled, but these dependencies are not properly exposed during CocoaPods dependency resolution when using prebuilt binaries.

### Solution

Enable building React Native from source by adding the following property to `ios/Podfile.properties.json`:

```json
{
  "expo.jsEngine": "hermes",
  "EX_DEV_CLIENT_NETWORK_INSPECTOR": "true",
  "newArchEnabled": "true",
  "ios.buildReactNativeFromSource": "true"  // Add this line
}
```

Then run:

```bash
cd ios
pod install
```

### Trade-offs

- ✅ **No version downgrades required** - maintains all current package versions
- ✅ **Full New Architecture support** - all dependencies properly resolved
- ✅ **Works with Expo** - compatible with Expo development builds
- ⚠️ **Slower first build** - initial iOS build will take ~5-10 minutes longer
- ✅ **Subsequent builds are fast** - thanks to build caching

### Alternative Solutions Attempted

The following solutions were tried but did not resolve the issue:

1. ❌ Running `pod repo update` - updates CocoaPods repository but doesn't fix dependency resolution
2. ❌ Explicitly adding `RCT-Folly` podspec in Podfile - causes version conflicts with dependencies
3. ❌ Clearing CocoaPods cache - temporary fix that doesn't address root cause
4. ❌ Adding explicit pod declarations - conflicts with prebuilt artifact expectations

### Prevention

If you're starting a new project with Expo and New Architecture, consider setting `ios.buildReactNativeFromSource: true` from the beginning to avoid this issue.

### Related Issues

- This issue affects any native module that requires New Architecture dependencies (RCT-Folly, RCTRequired, RCTTypeSafety, ReactCommon)
- Common libraries affected: `react-native-iap`, `react-native-reanimated` (in some cases), custom New Architecture modules

### Verification

After successful `pod install`, you should see:

```
Pod installation complete! There are 117 dependencies from the Podfile and 127 total pods installed.
```

The `RNIap` pod should be listed among installed pods with proper version (e.g., `RNIap (12.16.4)`).

