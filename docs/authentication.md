# Authentication System

## Overview

BossUp uses Firebase Authentication with three methods:
- **Email magic links (passwordless)** - primary method
- **Apple Sign-In** - OAuth
- **Google Sign-In** - OAuth

**Magic Link Domain:** `boss-app.ozma.io`
- Custom domain for Universal Links (iOS) and App Links (Android)
- Replaces deprecated Firebase Dynamic Links
- Serves both authentication and marketing content

---

## Architecture

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Firebase Config** | `constants/firebase.config.ts` | Initializes Firebase app, exports `auth` and `db` |
| **Auth Service** | `services/auth.service.ts` | All auth operations (magic links, Apple, Google, sign-out) |
| **Auth Context** | `contexts/AuthContext.tsx` | Global auth state, session persistence, web magic link handler |
| **Auth Components** | `components/auth/` | AuthButton, CodeInput, EmailAuthModal |
| **Auth Screens** | `app/(auth)/` | welcome, email-input, email-confirm |

### Data Types

**`User` (Auth State)** - minimal Firebase Auth data:
- `id: string` - Firebase Auth UID
- `email: string` - User's email
- `createdAt: string` - Account creation timestamp

**`UserProfile` (Firestore)** - full profile at `/users/{userId}`:
- All User fields plus: `name`, `goal`, `position`, `displayName`, `photoURL`, `subscription`, etc.

**When to use:**
- Use `User` for auth info only (ID, email)
- Use `UserProfile` for full profile data (name, goal, position)

---

## Email Magic Links

### User Flow

1. **Enter Email** → User enters email, no password
2. **Receive Link** → Firebase sends link: `https://boss-app.ozma.io?email=...&oobCode=...`
3. **Click Link** → Opens app (if installed) or browser
4. **Auto Sign-In** → Deep link handler verifies and signs user in

### Platform Behavior

**iOS Universal Links:**
- Opens app directly when magic link clicked
- Requires `app.config.ts` + `TheBossUp.entitlements` configuration
- Production builds only (TestFlight, App Store)

**Android App Links:**
- Opens app directly when magic link clicked
- Requires intent filter in `app.config.ts` + SHA-256 certificate
- Production builds only (signed release)

**Web:**
- Works in any browser
- `AuthContext.tsx` detects magic link in URL
- Works in development and production

### Development vs Production

| Environment | Web | Mobile | Universal/App Links |
|-------------|-----|--------|---------------------|
| **Production** | `https://boss-app.ozma.io` | `https://boss-app.ozma.io` | ✅ Works |
| **Development** | `http://localhost:8081` | Local IP or `bossup://` | ❌ HTTPS required |

**Development Setup:**
1. Add `localhost` to Firebase Console → Authentication → Authorized domains
2. Keep dual-mode detection in `auth.service.ts`
3. Use custom scheme `bossup://` for mobile testing
4. Or use Firebase Auth Emulator for offline dev

### Deep Link Handlers

- `app/(auth)/email-confirm.tsx` - Mobile deep link handler
- `components/auth/EmailAuthModal.tsx` - Modal handler
- `contexts/AuthContext.tsx` - Web handler

All use:
- `isSignInWithEmailLink(auth, url)` to detect Firebase magic link
- `signInWithEmailLink(auth, email, url)` to complete sign-in

### Custom Domain Setup

**Path Routing:**
- `/__/auth/*` → Firebase Authentication (automatic)
- `/` → Marketing website (static files from `dist/`)

**Verification Files (Auto-generated):**
- `/.well-known/apple-app-site-association` (iOS)
- `/.well-known/assetlinks.json` (Android)

### Security

- Single-use, time-limited links
- Server-side validation by Firebase
- Domain must be in authorized domains list
- User data scoped to `userId` via Firestore rules

---

## Apple Sign-In

**Flow:** Tap button → `signInWithApple()` → Native dialog → Authenticated

**Setup:** Firebase Console → Authentication → Enable Apple provider → Add Services ID, Team ID, Private Key, Key ID

---

## Google Sign-In

**Flow:** Tap button → `signInWithGoogle()` → OAuth dialog → Authenticated

**Setup:** Firebase Console → Authentication → Enable Google provider → Add Web Client ID

---

## State Management

### AuthContext

```typescript
interface AuthContextType {
  user: User | null;
  authState: 'loading' | 'authenticated' | 'unauthenticated';
  signOut: () => Promise<void>;
}
```

**Routing Logic (`app/_layout.tsx`):**
- `loading` → Show loading screen
- `unauthenticated` → Redirect to `/(auth)/welcome`
- `authenticated` → Redirect to `/(tabs)`

**Persistence:** Firebase auto-persists auth state via `onAuthStateChanged` listener

---

## Firebase Setup

### 1. Enable Authentication Methods

**Firebase Console → Authentication → Sign-in methods:**

**Email/Password:**
- Enable provider
- Enable "Email link (passwordless sign-in)"
- Add authorized domains: `boss-app.ozma.io`, `localhost`

**Apple:**
- Enable provider
- Add Services ID, Team ID, Private Key, Key ID, bundle ID

**Google:**
- Enable provider
- Add Web Client ID
- Configure OAuth consent screen

### 2. Connect Custom Domain

**Firebase Console → Hosting:**
1. Add custom domain: `boss-app.ozma.io`
2. Add DNS records (TXT for verification, A/CNAME for hosting)
3. Wait for SSL provisioning (~15 min)

### 3. Configure iOS

**`app.config.ts`:**
```typescript
associatedDomains: ['applinks:boss-app.ozma.io']
```

**`ios/TheBossUp/TheBossUp.entitlements`:**
Add `applinks:boss-app.ozma.io`

**Apple Developer:** Enable Associated Domains capability

### 4. Configure Android

**`app.config.ts`:**
```typescript
intentFilters: [{
  action: "VIEW",
  autoVerify: true,
  data: { host: "boss-app.ozma.io", pathPrefix: "/__/auth" }
}]
```

**Google Play Console:** Get SHA-256 certificate fingerprint

### 5. Deploy Firestore

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

---

## Security

**User Data Scoping:**
- All data at `/users/{userId}/entries/{entryId}`
- Firestore rules enforce: `request.auth.uid === userId`

**Environment Variables (`.env`):**
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

---

## Testing

### Production

**iOS/Android:**
1. Build production/TestFlight version
2. Send magic link email
3. Click link → App opens directly
4. Verify authentication works

**Web:**
1. Open `https://boss-app.ozma.io`
2. Send magic link → Click in email
3. Verify authentication works

### Development

**Web:**
```bash
npm run web
# Magic links work on localhost
```

**Mobile:**
```bash
npm run ios     # iOS Simulator
npm run android # Android Emulator
# Use custom scheme bossup:// or manual testing
```

**Firebase Emulator (optional):**
```bash
firebase emulators:start --only auth
# Instant email testing, no rate limits
```

---

## Troubleshooting

### iOS Universal Links Not Working

**Check:**
- Domain in Apple Developer App ID settings
- Certificate validity in verification file
- Reinstall app to clear cache

**Debug:**
```bash
curl -I https://boss-app.ozma.io/.well-known/apple-app-site-association
# Check iOS device logs for Universal Links errors
```

### Android App Links Not Opening

**Check:**
- SHA-256 matches in Google Play Console and `assetlinks.json`
- App Links verification status

**Debug:**
```bash
curl -I https://boss-app.ozma.io/.well-known/assetlinks.json
adb shell pm get-app-links com.ozmaio.bossup
adb shell pm verify-app-links --re-verify com.ozmaio.bossup
```

### Magic Link Invalid

**Common Causes:**
- Link expired or already used
- Domain not in Firebase authorized domains
- Missing `handleCodeInApp: true` in auth service

**Fix:** Check authorized domains, request new link

### Deep Links Not Working in Dev

**Expected:** Universal/App Links require HTTPS (production only)

**Workarounds:**
- Use TestFlight/internal testing for full testing
- Use custom scheme `bossup://` in development
- Test web version on localhost for quick iteration

---

## References

- [Firebase Email Link Auth](https://firebase.google.com/docs/auth/web/email-link-auth)
- [iOS Universal Links](https://developer.apple.com/ios/universal-links/)
- [Android App Links](https://developer.android.com/training/app-links)
- [Firebase Hosting Custom Domain](https://firebase.google.com/docs/hosting/custom-domain)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
