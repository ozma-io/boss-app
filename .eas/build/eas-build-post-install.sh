#!/bin/bash

# EAS Build post-install hook
# This script runs after npm/yarn install but before the build starts
# 
# It performs pre-build validations and fixes:
# 1. Check keyboard component imports (all platforms)
# 2. Fix Android manifest conflicts (Android only)

set -e  # Exit on error

echo ""
echo "🚀 Running pre-build checks and fixes..."
echo ""

# 1. Check keyboard imports (all platforms)
echo "📱 Step 1/2: Checking keyboard component imports..."
node scripts/check-keyboard-imports.js

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Build failed: Fix keyboard import errors above"
  exit 1
fi

# 2. Fix Android manifest (Android only)
echo ""
echo "📱 Step 2/2: Running Android manifest fix..."
bash .eas/build/fix-android-manifest.sh

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Build failed: Android manifest fix failed"
  exit 1
fi

echo ""
echo "✅ All pre-build checks and fixes completed successfully!"
echo ""

exit 0

