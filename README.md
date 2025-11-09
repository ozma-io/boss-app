# 📦 The Boss App

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
- **[Authentication](./docs/authentication.md)** - Email links, Apple/Google sign-in
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

### Backend / BaaS
- **Firebase** — complete backend platform:
  - **Firestore** — NoSQL cloud database
  - **Firebase Authentication** — login with email, social providers, Apple ID
  - **Firebase Cloud Messaging (FCM)** — push notification service
  - **Firebase Cloud Functions** — serverless backend logic (scheduling, triggers, etc.)
  - **Firebase Security Rules** — per-user access control

### Deployment
- **Expo EAS Build** — cloud builds for iOS and Android
- **Expo EAS Submit** — submission to App Store and Google Play
- **Expo EAS Update** — over-the-air (OTA) updates for JS/TS code and assets (no store resubmission needed)
- **Firebase Console / Hosting** — backend and data configuration

*Note: Using direct production rollouts (100% immediately). Gradual rollouts postponed until product validation.*

---

## 🗃️ Firestore Data Structure

```
/users/{userId}
  ├── bosses/{bossId}
  │   └── entries/{entryId}
```

**User data scoping:** All paths include `{userId}` - Firebase Security Rules enforce `request.auth.uid === userId`

**Entry types:** `note`, `survey`, `interaction` - flexible timeline history

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
├── components/             # Reusable UI components
├── services/               # Firebase services (auth, firestore, notifications)
├── types/                  # TypeScript type definitions
├── functions/              # Firebase Cloud Functions
├── firestore/              # Database tooling
│   ├── schemas/           # TypeScript schemas (not deployed)
│   └── migrations/        # Data migration scripts
├── docs/                   # Documentation
├── scripts/                # Automation scripts
├── firestore.rules         # Firestore Security Rules
└── firestore.indexes.json  # Firestore Indexes
```

📖 **For detailed setup, see [SETUP.md](./SETUP.md)**
