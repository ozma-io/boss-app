# 📦 Boss Relationship Tracker

## 🚀 Run Locally
```bash
npm run dev    # Dev server (choose platform)
npm run web    # Web browser
npm run ios    # iOS simulator (builds Development Build)
npm run android # Android emulator (builds Development Build)
```

**Note:** First iOS/Android build takes ~5-10 minutes. Subsequent JavaScript changes load instantly via hot reload.

## 🚢 Deploy to Firebase

**Initial setup** (creates database, deploys rules & indexes):
```bash
./scripts/setup-firestore.sh
```

**Deploy changes:**
```bash
# Deploy Cloud Functions (backend)
cd functions && npm run build && cd .. && firebase deploy --only functions

# First-time deploy or force cleanup policy setup
firebase deploy --only functions --force

# Deploy Firestore Rules (security)
firebase deploy --only firestore:rules

# Deploy Firestore Indexes
firebase deploy --only firestore:indexes

# Deploy everything
firebase deploy
```

**Run Data Migration** (manual, one-time scripts):
```bash
cd firestore/migrations && npm run migrate -- YYYY-MM-DD-migration-name
```

**Note:** `/firestore/schemas/` are TypeScript types only (not deployed).

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

# 🗃️ Firebase Firestore Data Structure

## Collection: Users
Path: `/users/{userId}`

User document example:
*JSON:*
{
  "email": "user@example.com",
  "currentBossId": "abc123",
  "createdAt": "2025-10-19T10:00:00Z"
}

---

## Subcollection: Bosses
Path: `/users/{userId}/bosses/{bossId}`

Boss document example:
*JSON:*
{
  "name": "Olga Ivanovna",
  "position": "CTO",
  "startedAt": "2025-09-01T00:00:00Z"
}

---

## Subcollection: Entries (Flexible History)
Path: `/users/{userId}/bosses/{bossId}/entries/{entryId}`

Each entry represents a note, interaction, survey, etc., distinguished by `type`.

### Example entry: Note
*JSON:*
{
  "type": "note",
  "timestamp": "2025-10-19T11:00:00Z",
  "content": "Boss seemed tense before the meeting."
}

### Example entry: Survey
*JSON:*
{
  "type": "survey",
  "timestamp": "2025-10-17T08:00:00Z",
  "survey": {
    "trustLevel": 4,
    "support": 5
  }
}

### Example entry: Interaction
*JSON:*
{
  "type": "interaction",
  "timestamp": "2025-10-16T15:30:00Z",
  "mood": "neutral",
  "notes": "Discussed quarterly goals."
}

---

🔐 **Security**: Firestore Security Rules ensure that `request.auth.uid === userId`. This guarantees that users can only access their own documents.

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

**When to rebuild:**
- Adding native modules or Expo plugins
- Changing `app.json` or `app.config.js`
- Updating Expo SDK version

**Regular development:**
- JavaScript/TypeScript changes reload instantly (no rebuild needed)
- Use `npm run dev` and scan QR code
- Web version unchanged

### Project Structure

- `app/` - File-based routing (Expo Router)
- `components/` - Reusable UI components
- `services/` - Firebase services (auth, firestore, notifications)
- `types/` - TypeScript type definitions
- `utils/` - Helper functions
- `functions/` - **Firebase Cloud Functions** (deploy: `firebase deploy --only functions`)
- `firestore.rules` - **Firestore Security Rules** (deploy: `firebase deploy --only firestore:rules`)
- `firestore.indexes.json` - **Firestore Indexes** (deploy: `firebase deploy --only firestore:indexes`)
- `firestore/` - Database tooling (local only)
  - `migrations/` - Migration scripts (run: `cd firestore/migrations && npm run migrate`)
  - `schemas/` - TypeScript types (not deployed)
- `__tests__/` - Unit tests

📖 **For detailed setup instructions, see [SETUP.md](./SETUP.md)**
