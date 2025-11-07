# Authentication System

## Overview

Boss App uses Firebase Authentication with email link sign-in (passwordless) as the primary method, with support for Apple and Google OAuth providers.

## Architecture

### Components

1. **Firebase Configuration** (`constants/firebase.config.ts`)
   - Initializes Firebase app with environment variables
   - Exports `auth` and `db` instances for use throughout the app

2. **Auth Service** (`services/auth.service.ts`)
   - Handles all authentication operations
   - Methods: email link sign-in, Apple sign-in, Google sign-in, sign-out
   - Returns typed `User` objects

3. **Auth Context** (`contexts/AuthContext.tsx`)
   - Provides global authentication state
   - Manages user session persistence
   - Handles auth state changes via Firebase listener

4. **Auth Components** (`components/auth/`)
   - `AuthButton.tsx` - Styled buttons for authentication methods
   - `CodeInput.tsx` - 4-digit verification code input

5. **Auth Screens** (`app/(auth)/`)
   - `welcome.tsx` - Entry screen with sign-in options
   - `email-input.tsx` - Email input and verification code sending
   - `email-confirm.tsx` - Verification code confirmation

## Authentication Flow

### Email Link Authentication (Passwordless)

1. User enters email on `email-input` screen
2. App calls `auth.service.sendSignInLinkToEmail()` which sends verification email
3. User receives email with 4-digit code
4. User enters code on `email-confirm` screen
5. App verifies code with Firebase
6. On success, user is authenticated and redirected to main app

### Apple Sign-In

1. User taps "Continue with Apple" button on `welcome` screen
2. App calls `auth.service.signInWithApple()`
3. Native Apple authentication dialog appears
4. On success, user is authenticated and redirected to main app

### Google Sign-In

1. User taps "Continue with Google" button on `welcome` screen
2. Currently shows "Coming Soon" alert (requires additional OAuth configuration)
3. Will use `auth.service.signInWithGoogle()` when configured

## State Management

### AuthContext Provider

The `AuthProvider` wraps the entire app in `app/_layout.tsx` and provides:

```typescript
interface AuthContextType {
  user: User | null;
  authState: 'loading' | 'authenticated' | 'unauthenticated';
  signOut: () => Promise<void>;
}
```

### Auth State Persistence

Firebase automatically persists authentication state across app restarts. The AuthContext listens to Firebase's `onAuthStateChanged` event to keep the app state synchronized.

## Routing Logic

In `app/_layout.tsx`:
- If `authState === 'loading'`: Show loading screen
- If `authState === 'unauthenticated'`: Redirect to `/(auth)/welcome`
- If `authState === 'authenticated'`: Redirect to `/(tabs)` (main app)

## Security

### User Data Scoping

All user data in Firestore is scoped to `userId`:
- Path structure: `/users/{userId}/bosses/{bossId}/entries/{entryId}`
- Firebase Security Rules enforce `request.auth.uid === userId`

### Environment Variables

Sensitive Firebase configuration is stored in `.env` file:
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

## Data Types

### User Type

```typescript
interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
```

### Auth State Type

```typescript
type AuthState = 'loading' | 'authenticated' | 'unauthenticated';
```

## Firebase Setup Requirements

### Authentication Methods

Enable in Firebase Console → Authentication → Sign-in methods:
1. Email/Password (with passwordless email link enabled)
2. Apple (for iOS)
3. Google (optional)

### Firestore Database

1. Create Firestore database in Firebase Console
2. Configure security rules to enforce user-scoped data access
3. Use test mode for development, production rules for deployment

### Email Link Configuration

In Firebase Console → Authentication → Templates:
- Customize email action handler URL to match app's deep link
- Template uses app scheme defined in environment variables

## Implementation Details

### Email Verification Code

The system uses Firebase's `sendSignInLinkToEmail` which sends a verification link. The implementation extracts a 4-digit code from the email for easier mobile UX.

### Session Management

- Firebase handles session tokens automatically
- Sessions persist until user signs out or token expires
- `signOut()` method clears local state and Firebase session

### Error Handling

Authentication errors are caught and displayed to users with appropriate messages. Common errors:
- Invalid email format
- Expired verification code
- Network connectivity issues
- OAuth cancellation

## Testing

Authentication can be tested using Firebase Authentication Emulator:
1. Start emulator: `firebase emulators:start --only auth`
2. Configure app to use emulator endpoint
3. Test all authentication flows without affecting production data

