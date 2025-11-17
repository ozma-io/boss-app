#!/bin/bash

# Fix Android manifest merger conflict for EAS Build
# 
# Problem: Both expo-notifications and @react-native-firebase/messaging define
# com.google.firebase.messaging.default_notification_color with different values
# 
# Solution: Add tools:replace attribute to use our app's value instead of the library's default
# 
# This script runs as a prebuildCommand in eas.json after expo prebuild generates the manifest
# See docs/android-manifest-conflict.md for full explanation

set -e  # Exit on error

MANIFEST_FILE="android/app/src/main/AndroidManifest.xml"

echo "🔧 Fixing Android manifest conflict..."

if [ ! -f "$MANIFEST_FILE" ]; then
  echo "❌ Error: AndroidManifest.xml not found at $MANIFEST_FILE"
  exit 1
fi

# Add tools namespace to manifest root if not present
if ! grep -q 'xmlns:tools' "$MANIFEST_FILE"; then
  echo "  ✓ Adding xmlns:tools namespace..."
  sed -i.bak 's/<manifest xmlns:android="http:\/\/schemas.android.com\/apk\/res\/android">/<manifest xmlns:android="http:\/\/schemas.android.com\/apk\/res\/android" xmlns:tools="http:\/\/schemas.android.com\/tools">/' "$MANIFEST_FILE"
  rm -f "${MANIFEST_FILE}.bak"
else
  echo "  ℹ️  xmlns:tools already present"
fi

# Add tools:replace to notification color meta-data
if grep -q 'android:name="com.google.firebase.messaging.default_notification_color"' "$MANIFEST_FILE"; then
  if ! grep -q 'tools:replace="android:resource"' "$MANIFEST_FILE"; then
    echo "  ✓ Adding tools:replace to notification color meta-data..."
    sed -i.bak 's/\(android:name="com\.google\.firebase\.messaging\.default_notification_color" android:resource="@color\/notification_icon_color"\)/\1 tools:replace="android:resource"/' "$MANIFEST_FILE"
    rm -f "${MANIFEST_FILE}.bak"
  else
    echo "  ℹ️  tools:replace already present"
  fi
else
  echo "  ⚠️  Warning: notification color meta-data not found (this is OK if prebuild hasn't added it yet)"
fi

echo "✅ Android manifest fix completed"

