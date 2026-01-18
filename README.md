# BossUp

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Web-blue.svg)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB.svg)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-SDK%2052-000020.svg)](https://expo.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Backend-FFCA28.svg)](https://firebase.google.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6.svg)](https://www.typescriptlang.org)

A mobile app for managing workplace relationships with managers/bosses, featuring AI-powered coaching, timeline tracking, and personalized insights. Built with React Native, Expo, and Firebase.

<p align="center">
  <img src="docs/screenshots/app-banner.png" alt="BossUp App Screenshots" width="100%">
</p>

## Features

- **AI-Powered Coaching** - Chat with an AI assistant (GPT-5) for personalized workplace advice
- **Boss Timeline** - Track interactions, feedback, achievements, and challenges with your manager
- **Custom Fields** - Add personalized tracking fields for each boss profile
- **Push Notifications** - Smart reminders and AI-generated check-ins
- **Cross-Platform** - iOS, Android, and Web from a single codebase
- **Subscription Support** - In-app purchases (iOS/Android) and Stripe (Web)
- **Privacy-First** - All data scoped to user accounts with Firebase Security Rules

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Mobile** | React Native + Expo (Development Build) |
| **Navigation** | Expo Router (file-based) |
| **Language** | TypeScript (strict mode) |
| **Backend** | Firebase (Firestore, Auth, Cloud Functions, FCM) |
| **AI** | OpenAI API (GPT-5) |
| **Payments** | Apple IAP, Google Play Billing, Stripe |

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 18+ and npm
- **iOS Development**: Xcode 15+ (macOS only)
- **Android Development**: Android Studio with SDK 34+
- **Firebase Account**: [console.firebase.google.com](https://console.firebase.google.com)

Optional (for full functionality):
- **OpenAI API Key** - for AI chat feature
- **Apple Developer Account** - for iOS IAP and App Store
- **Google Play Console** - for Android IAP and Play Store

## Quick Start

```bash
# Clone the repository
git clone https://github.com/ozma-io/boss-app.git
cd boss-app

# Install dependencies
npm install

# Start development server
npm run dev
```

Then choose your platform:
- Press `w` for Web browser
- Press `i` for iOS Simulator (requires Xcode)
- Press `a` for Android Emulator (requires Android Studio)

**Note:** First iOS/Android build takes ~5-10 minutes to compile the Development Build. Subsequent JavaScript changes reload instantly via hot reload.

## Configuration

### 1. Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication (Email/Password, Apple, Google)
3. Create a Firestore database
4. Download config files:
   - `google-services.json` → `firebase/google-services.json`
   - `GoogleService-Info.plist` → `firebase/GoogleService-Info.plist`

### 2. Environment Variables

Create configuration based on `.env.example`:

```bash
# Firebase Web Config (from Firebase Console → Project Settings)
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 3. Cloud Functions Setup

```bash
cd functions
npm install

# Set required secrets (for AI chat)
firebase functions:secrets:set OPENAI_API_KEY

# Deploy functions
firebase deploy --only functions
```

### 4. Deploy Firestore Rules & Indexes

```bash
./scripts/setup-firestore.sh
firebase deploy --only firestore
```

## Project Structure

```
boss-app/
├── app/                    # Expo Router screens
├── components/             # Reusable UI components
├── services/               # Firebase services (auth, chat, notifications)
├── types/                  # TypeScript definitions
├── firestore/
│   ├── schemas/           # Type definitions (single source of truth)
│   └── migrations/        # Data migration scripts
├── functions/              # Cloud Functions (TypeScript)
├── functions-python/       # Cloud Functions (Python)
└── docs/                   # Documentation
```

## Documentation

- **[Setup Instructions](./SETUP.md)** - Detailed project setup
- **[Firebase Deployment](./docs/firebase-deployment.md)** - Deploy Cloud Functions, rules, indexes
- **[Firestore Management](./docs/firestore-management.md)** - Schemas, migrations, security
- **[Authentication](./docs/authentication.md)** - Email links, Apple/Google sign-in
- **[Subscriptions & IAP](./docs/subscriptions-iap.md)** - In-app purchases setup
- **[All Documentation](./docs/README.md)** - Complete documentation index

## Development

```bash
npm run dev      # Start dev server (choose platform)
npm run web      # Web browser only
npm run ios      # iOS simulator
npm run android  # Android emulator
npm test         # Run tests
```

### When to Rebuild

Only rebuild native code when:
- Adding native modules or Expo plugins
- Changing `app.config.ts`
- Updating Expo SDK version

Regular JavaScript/TypeScript changes use hot reload automatically.

## Deployment

This repository includes GitHub Actions workflows for CI/CD:

| Workflow | Purpose |
|----------|---------|
| `eas-build.yml` | Build iOS/Android apps via Expo EAS |
| `eas-update.yml` | Push OTA updates via Expo EAS |
| `firebase-functions-deploy.yml` | Deploy Cloud Functions |
| `firebase-firestore-deploy.yml` | Deploy Firestore rules and indexes |
| `firebase-hosting-deploy.yml` | Deploy web version to Firebase Hosting |
| `firebase-remoteconfig-deploy.yml` | Deploy Remote Config |

Workflows are located in `.github/workflows/`. Configure repository secrets in GitHub Settings for automated deployments.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code:
- Uses TypeScript with strict typing
- Follows the existing code style
- Includes appropriate tests
- Updates documentation as needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with [Expo](https://expo.dev) and [Firebase](https://firebase.google.com) by [Ozma](https://ozma.io)
