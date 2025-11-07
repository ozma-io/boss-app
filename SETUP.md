# Boss App - Setup Instructions

## ✅ Completed Setup

The project has been successfully initialized with:

- ✅ **Expo Router** (file-based routing) - modern navigation
- ✅ **TypeScript** - strict typing throughout
- ✅ **Firebase SDK** - installed and ready to configure
- ✅ **Testing libraries** - Jest and React Native Testing Library
- ✅ **Firebase Cloud Functions** - directory structure created

## 📁 Project Structure

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
├── functions/               # Firebase Cloud Functions
│   ├── src/                 # Cloud Functions source
│   ├── package.json         # Functions dependencies
│   └── tsconfig.json        # Functions TypeScript config
├── __tests__/               # Unit tests
│   ├── components/
│   └── services/
└── assets/                  # Images, fonts, static resources
```

## 🚀 Next Steps

### 1. Firebase Configuration

Create `constants/firebase.config.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

### 2. Create TypeScript Types

In `types/` directory, create:

- `user.types.ts` - User model
- `boss.types.ts` - Boss model
- `entry.types.ts` - Entry model (notes, surveys, interactions)

### 3. Implement Firebase Services

In `services/` directory, create:

- `auth.service.ts` - Authentication logic
- `firestore.service.ts` - Database operations
- `notifications.service.ts` - FCM push notifications

### 4. Build Screens

In `app/` directory:

- Modify `app/(tabs)/index.tsx` - Boss list screen
- Modify `app/(tabs)/profile.tsx` - User profile (rename from two.tsx)
- Create `app/boss/[id].tsx` - Boss details (dynamic route)
- Create `app/boss/add-entry.tsx` - Add entry screen

### 5. Setup Firebase Cloud Functions

```bash
cd functions
npm install
npm run build
```

### 6. Initialize Firebase Project

```bash
# Install Firebase CLI globally (if not already installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init
# Select: Functions, Firestore, Hosting (optional)
```

## 🏃 Running the App

```bash
# Install dependencies (if needed)
npm install

# Start development server
npm run dev

# Run on specific platform
npm run ios       # iOS simulator (builds Development Build first time)
npm run android   # Android emulator (builds Development Build first time)
npm run web       # Web browser

# Run tests
npm test
```

**First time:** iOS/Android builds take ~5-10 minutes to compile the Development Build.

**After that:** JavaScript changes reload instantly via hot reload (like Expo Go).

## 🔧 Development Build

This project uses **Expo Development Build** instead of Expo Go.

### Why Development Build?

- ✅ **Production-like environment**: No Firestore offline mode issues
- ✅ **Native WebSocket support**: Firestore works instantly (<1 sec)
- ✅ **Full native module support**: No limitations
- ✅ **Hot reload preserved**: JavaScript changes still instant

### Requirements

- **iOS**: Xcode installed (for iOS simulator)
- **Android**: Android Studio installed (for Android emulator)

### First Build

```bash
# iOS (first time: ~5-10 minutes)
npm run ios

# Android (first time: ~5-10 minutes)
npm run android
```

This compiles a custom native app with all required modules.

### Daily Development Workflow

1. Start dev server: `npm run dev`
2. Scan QR code with camera (if using physical device)
3. Make JavaScript/TypeScript changes → hot reload works!
4. No rebuild needed for code changes

### When to Rebuild

Only rebuild when you:
- Add native modules or Expo plugins
- Change `app.json` or `app.config.js`
- Update Expo SDK version

Otherwise, Development Build works exactly like Expo Go!

## 📱 Development Workflow

1. **Local Development**: Use `npm run dev` with Development Build
2. **Testing**: Write tests in `__tests__/` directory
3. **Firebase Emulators**: Test Cloud Functions locally before deploying
4. **Type Safety**: Ensure all files use TypeScript with strict types

## 🔧 Useful Commands

```bash
# Clear Expo cache
npx expo start --clear

# Update Expo SDK
npx expo install --fix

# Deploy Cloud Functions
cd functions && npm run deploy

# View Cloud Functions logs
cd functions && npm run logs
```

## 📚 Documentation

- [Expo Router Docs](https://docs.expo.dev/router/introduction/)
- [Firebase for React Native](https://rnfirebase.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🎯 MVP Focus

Remember: This is an MVP. Focus on:
- ✅ Core functionality only
- ✅ Simple, clean code
- ✅ Type safety everywhere
- ✅ Minimal but effective testing
- ❌ Avoid over-engineering
- ❌ No premature optimization

