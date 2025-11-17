# 📦 BossUp

## 🚀 Quick Start

```bash
npm run dev    # Dev server (choose platform)
npm run web    # Web browser
npm run ios    # iOS simulator (builds Development Build)
npm run android # Android emulator (builds Development Build)
```

**Note:** First iOS/Android build takes ~5-10 minutes. Subsequent JavaScript changes load instantly via hot reload.

## 📚 Documentation

**📖 [Complete Documentation Index](./docs/README.md)**

Quick links:
- **[Setup Instructions](./SETUP.md)** - Initial project setup
- **[Firebase Deployment](./docs/firebase-deployment.md)** - Deploy Cloud Functions, rules, indexes
- **[Firestore Management](./docs/firestore-management.md)** - Schemas, migrations, security
- **[Authentication](./docs/authentication.md)** - Magic links, Apple/Google sign-in, Universal Links
- **Logging** - Use `services/logger.service.ts` in app code, `functions/src/logger.ts` (with Sentry) in Cloud Functions
- **Pre-auth Permission Flows** - Custom screens + system prompts for notifications and ATT (see `NotificationOnboardingScreen` and `TrackingOnboardingScreen`)

## 🚢 Deploy to Firebase

**Quick deploy:**
```bash
./scripts/setup-firestore.sh  # Initial setup
firebase deploy               # Deploy everything
```

📖 **For detailed deployment instructions, see [docs/firebase-deployment.md](./docs/firebase-deployment.md)**

---

## 🧱 Technology Stack

### Client (Mobile App)
- **React Native** — cross-platform development (iOS + Android)
- **Expo** — fast setup, simplified build and deployment
- **Expo Development Build** — native development environment with full module support
- **TypeScript** — required; improves type safety and developer experience
- **Expo Router** — file-based routing and navigation (like Next.js)
- **Expo Notifications** — receiving push notifications on the device
- **react-native-iap** — Apple and Google in-app purchases (iOS implemented, Android coming soon)

### Backend / BaaS
- **Firebase** — complete backend platform:
  - **Firestore** — NoSQL cloud database
  - **Firebase Authentication** — login with email, social providers, Apple ID
  - **Firebase Cloud Messaging (FCM)** — push notification service
  - **Firebase Cloud Functions** — serverless backend logic (scheduling, triggers, etc.)
  - **Firebase Security Rules** — per-user access control
- **OpenAI API** — AI chat integration (GPT-5 via Cloud Functions)
- **Apple App Store Server API** — IAP receipt verification (via Cloud Functions)
- **Stripe API** — web subscriptions and migration handling (Cloud Functions only, not in app)

### Deployment
- **Expo EAS Build** — cloud builds for iOS and Android
- **Expo EAS Submit** — submission to App Store and Google Play
- **Expo EAS Update** — over-the-air (OTA) updates for JS/TS code and assets (no store resubmission needed)
- **Firebase Console / Hosting** — backend and data configuration

**Build production releases for both iOS and Android:**
```bash
npx eas-cli@latest workflow:run create-production-builds.yml
```

*Note: Using direct production rollouts (100% immediately). Gradual rollouts postponed until product validation.*

### Android Manifest Conflict

The Android build automatically resolves a manifest conflict between `expo-notifications` and `@react-native-firebase/messaging` (both define notification color). This is handled via:
- **Local development:** Config plugin (`plugins/withNotificationManifestFix.js`)
- **EAS Build:** Prebuild hook script (`.eas/build/fix-android-manifest.sh`)

📖 **See [docs/android-manifest-conflict.md](./docs/android-manifest-conflict.md) for technical details**

---

## 🗃️ Firestore Data Structure

```
/users/{userId}
  ├── bosses/{bossId}
  │   └── entries/{entryId}
  └── chatThreads/{threadId}
      └── messages/{messageId}
```

**Types:** `User` (auth state with id/email) vs `UserProfile` (Firestore document with full profile data) - see [docs/authentication.md](./docs/authentication.md) and [docs/firestore-management.md](./docs/firestore-management.md)

**User data scoping:** All paths include `{userId}` - Firebase Security Rules enforce `request.auth.uid === userId`

**Entry types:**
- `note` with subtypes: `note`, `interaction`, `feedback`, `achievement`, `challenge`, `other` - text-based timeline events
- `fact` - single data points for tracking measurements over time

**Chat:**
- `chatThreads` - AI conversation sessions (OpenAI-compatible multimodal format)
- `messages` - chat messages with roles: `user`, `assistant`, `system`

### Data Organization Principle

**Timeline (Entries)** — frequently changing data (daily/weekly assessments):
- Current mood, stress level today, confidence this week
- Use `FactEntry` type for trackable metrics that change over time
- Use `NoteEntry` with appropriate subtype for events and observations
- Examples: daily stress assessment, weekly confidence check-in, meeting notes, feedback received

**User/Boss Documents** — stable characteristics (rarely change):
- Position, department, goal, communication preferences, working hours
- Store as fields directly in User or Boss documents
- Examples: job title, team, career goal, boss's management style

📖 **For detailed schemas and examples, see [docs/firestore-management.md](./docs/firestore-management.md)**

---

## 🚀 Getting Started

The project is initialized with Expo Router and ready for development.

### Quick Start

```bash
# Install dependencies (if needed)
npm install

# Start development server
npm run dev

# Run on specific platform (first time builds Development Build)
npm run ios       # iOS simulator (~5-10 min first time)
npm run android   # Android emulator (~5-10 min first time)
npm run web       # Web browser
```

### 📱 Development Build

This project uses **Expo Development Build** for full native module support and production-like environment.

**Key features:**
- ✅ Full native module support (Firestore WebSocket works perfectly)
- ✅ Production-like environment
- ✅ Custom native code and configurations
- ✅ Hot reload for JavaScript changes
- ✅ Pre-auth permission flows for notifications and tracking (custom UI + system prompts)

**When to rebuild:**
- Adding native modules or Expo plugins
- Changing `app.json` or `app.config.js`
- Updating Expo SDK version

**Regular development:**
- JavaScript/TypeScript changes reload instantly (no rebuild needed)
- Use `npm run dev` and scan QR code
- Web version unchanged

### Project Structure

```
boss-app/
├── app/                    # Expo Router screens (file-based routing)
│   ├── chat.tsx           # AI chat screen
│   └── subscription.tsx   # Subscription/IAP screen
├── components/             # Reusable UI components
├── services/               # Firebase services (auth, firestore, notifications, chat)
│   ├── chat.service.ts    # Chat service (messages, AI response triggering)
│   └── iap.service.ts     # In-app purchase service (iOS/Android)
├── types/                  # TypeScript type definitions
├── functions/              # Firebase Cloud Functions
│   └── src/
│       ├── chat.ts        # OpenAI integration (GPT-5)
│       ├── iap-verification.ts # IAP receipt verification (Apple/Google)
│       └── types/chat.types.ts
├── firestore/              # Database tooling
│   ├── schemas/           # TypeScript schemas (not deployed)
│   │   └── chat.schema.ts # Chat data schemas
│   └── migrations/        # Data migration scripts
├── docs/                   # Documentation
├── scripts/                # Automation scripts
├── firestore.rules         # Firestore Security Rules
└── firestore.indexes.json  # Firestore Indexes
```

📖 **For detailed setup, see [SETUP.md](./SETUP.md)**
