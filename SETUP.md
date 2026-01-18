# BossUp - Setup Guide

This guide walks you through setting up BossUp for local development.

## Project Structure

```
boss-app/
├── app/                      # Expo Router - file-based navigation
│   ├── (tabs)/              # Tab navigation screens
│   ├── _layout.tsx          # Root layout
│   └── +not-found.tsx       # 404 screen
├── components/              # Reusable UI components
├── services/                # Firebase services (auth, firestore, FCM)
├── types/                   # TypeScript type definitions
├── utils/                   # Helper functions
├── constants/               # App constants (colors, config)
├── functions/               # Firebase Cloud Functions (TypeScript)
│   ├── src/                 # Cloud Functions source
│   ├── package.json         # Functions dependencies
│   └── tsconfig.json        # Functions TypeScript config
├── functions-python/        # Firebase Cloud Functions (Python)
├── firestore/               # Database schemas and migrations
│   ├── schemas/            # TypeScript schemas (source of truth)
│   └── migrations/         # Data migration scripts
└── assets/                  # Images, fonts, static resources
```

## Prerequisites

Ensure you have installed:

- **Node.js** 18+ ([nodejs.org](https://nodejs.org))
- **Git** ([git-scm.com](https://git-scm.com))

For mobile development:
- **iOS**: Xcode 15+ (macOS only, from App Store)
- **Android**: Android Studio with SDK 34+ ([developer.android.com](https://developer.android.com/studio))

## Step 1: Clone and Install

```bash
git clone https://github.com/ozma-io/boss-app.git
cd boss-app
npm install
```

## Step 2: Firebase Configuration

### Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project" and follow the wizard
3. Enable Google Analytics (optional)

### Enable Authentication

1. Go to **Authentication** → **Sign-in method**
2. Enable the providers you need:
   - Email/Password (required)
   - Apple (for iOS app)
   - Google (for Android app)

### Create Firestore Database

1. Go to **Firestore Database** → **Create database**
2. Start in **production mode**
3. Choose a location close to your users

### Download Config Files

1. Go to **Project Settings** → **Your apps**
2. Add an iOS app and download `GoogleService-Info.plist`
3. Add an Android app and download `google-services.json`
4. Add a Web app and copy the config object

Place the files:
```
firebase/
├── google-services.json        # Android config
└── GoogleService-Info.plist    # iOS config
```

### Set Environment Variables

Create your environment configuration based on `.env.example`:

```bash
# Firebase Web Config
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Step 3: Deploy Firestore Rules and Indexes

```bash
# Initial Firestore setup
./scripts/setup-firestore.sh

# Or manually deploy
firebase deploy --only firestore:rules,firestore:indexes
```

## Step 4: Cloud Functions Setup

```bash
cd functions
npm install

# Set required secrets
firebase functions:secrets:set OPENAI_API_KEY  # For AI chat

# Optional secrets for IAP
firebase functions:secrets:set APPLE_APP_STORE_PRIVATE_KEY
firebase functions:secrets:set STRIPE_SECRET_KEY

# Build and deploy
npm run build
firebase deploy --only functions
```

For detailed deployment instructions, see [docs/firebase-deployment.md](./docs/firebase-deployment.md).

## Step 5: Run the App

```bash
# Start development server
npm run dev

# Or run on specific platform
npm run ios       # iOS simulator
npm run android   # Android emulator
npm run web       # Web browser
```

**First run note:** iOS/Android builds take ~5-10 minutes to compile the Development Build. After that, JavaScript changes reload instantly.

## Development Build

This project uses **Expo Development Build** for full native module support.

### Key Benefits

- Production-like environment
- Full native module support (Firestore, notifications, IAP)
- Hot reload for JavaScript changes

### Requirements

- **iOS**: Xcode installed (for iOS simulator)
- **Android**: Android Studio installed (for Android emulator)

### When to Rebuild

Only rebuild when you:
- Add native modules or Expo plugins
- Change `app.config.ts`
- Update Expo SDK version

```bash
# Rebuild iOS
cd ios && pod install && cd .. && npx expo run:ios

# Rebuild Android
npx expo run:android
```

## Daily Development Workflow

1. Start dev server: `npm run dev`
2. Choose platform (w/i/a)
3. Make JavaScript/TypeScript changes → hot reload works!
4. No rebuild needed for code changes

## Running Tests

```bash
npm test
```

## Useful Commands

```bash
# Clear Expo cache
npx expo start --clear

# Update Expo SDK
npx expo install --fix

# Check for outdated packages
npm outdated
```

## Documentation

- [Firebase Deployment Guide](./docs/firebase-deployment.md) - Deploy Cloud Functions, rules, indexes
- [Firestore Management](./docs/firestore-management.md) - Schemas, migrations, security rules
- [Authentication System](./docs/authentication.md) - Email links, Apple/Google sign-in
- [Subscriptions & IAP](./docs/subscriptions-iap.md) - In-app purchases setup and testing
- [Magic Link Development](./docs/magic-link-development.md) - Testing auth in development

## External Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router Docs](https://docs.expo.dev/router/introduction/)
- [Firebase for React Native](https://rnfirebase.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Troubleshooting

### iOS Pod Install Issues

See [docs/troubleshooting-ios-pod-install.md](./docs/troubleshooting-ios-pod-install.md) for solutions to common CocoaPods errors.

### Firestore Connection Issues

Ensure you're using the Development Build, not Expo Go. The Development Build has full native WebSocket support required for Firestore real-time updates.

### Authentication Not Working

1. Check Firebase config files are in `firebase/` directory
2. Verify environment variables are set correctly
3. Ensure Authentication providers are enabled in Firebase Console
