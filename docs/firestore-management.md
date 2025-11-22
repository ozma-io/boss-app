# Firestore Management Guide

Complete guide for managing Firestore database schemas, security rules, indexes, and data migrations.

📖 **For Firebase deployment instructions, see [firebase-deployment.md](./firebase-deployment.md)**

---

## 📁 Project Structure

```
firestore/
├── schemas/              # TypeScript type definitions (application-level schemas)
│   ├── user.schema.ts
│   ├── boss.schema.ts
│   ├── entry.schema.ts
│   └── index.ts
├── migrations/           # Data migration scripts
│   ├── package.json
│   ├── run-migration.ts
│   ├── examples/
│   └── README.md
firestore.rules           # Security rules (access control)
firestore.indexes.json    # Database indexes (performance)
firebase.json             # Firebase CLI configuration
.firebaserc               # Project aliases
```

---

## 🔐 Security Rules

### Current Rules

Location: `firestore.rules`

```javascript
// Users can only access their own data
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
  
  // Entries at user level
  match /entries/{entryId} {
    allow read, write: if request.auth.uid == userId;
  }
  
  // Bosses subcollection
  match /bosses/{bossId} {
    allow read, write: if request.auth.uid == userId;
  }
}
```

### Testing Rules Locally

```bash
# Start Firestore emulator
firebase emulators:start --only firestore

# In another terminal, run tests
npm test
```

### Deploying Rules

📖 **See [firebase-deployment.md](./firebase-deployment.md) for deployment instructions**

---

## 📊 Data Schemas

### Philosophy

Firestore is **schemaless** at the database level, but we enforce schemas through:

1. **TypeScript types** (compile-time validation)
2. **Application logic** (runtime validation)
3. **Security rules** (server-side validation)

### Schema Files

- `firestore/schemas/user.schema.ts` - User documents
- `firestore/schemas/boss.schema.ts` - Boss documents
- `firestore/schemas/entry.schema.ts` - Timeline entries

### Using Schemas

```typescript
import { BossSchema, BossDefaults } from '@/firestore/schemas';

// When creating a new boss
const newBoss: BossSchema = {
  ...BossDefaults,
  name: 'Jane Doe',
  position: 'CTO',
  department: 'Engineering',
  startedAt: new Date().toISOString(),
};

await setDoc(doc(db, 'users', userId, 'bosses', bossId), newBoss);
```

### User vs UserProfile

The codebase uses two distinct types for user-related data:

#### User (Authentication State)

**Location:** `types/index.ts`  
**Purpose:** In-memory representation of authenticated user  
**Used in:** `AuthContext`, `auth.service.ts`

```typescript
interface User {
  id: string;
  email: string;
  createdAt: string;
}
```

**Required fields:** `id`, `email`, `createdAt`

This type contains minimal data from Firebase Authentication and is used for:
- Authentication state management
- Checking if user is logged in
- Getting user ID for Firestore queries

#### UserProfile (Firestore Document)

**Location:** `types/index.ts`  
**Source of truth:** `firestore/schemas/user.schema.ts` (UserSchema)  
**Purpose:** Full user profile stored in Firestore  
**Path:** `/users/{userId}`  
**Used in:** `user.service.ts`, profile components

```typescript
interface UserProfile {
  email: string;
  name: string;          // Required
  goal: string;          // Required
  position: string;      // Required
  displayName?: string;
  photoURL?: string;
  createdAt: string;
  updatedAt?: string;
  subscription?: UserSubscription;
  // ... additional fields
}
```

**Required fields:** `email`, `name`, `goal`, `position`, `createdAt`

This type contains complete user profile data and is used for:
- Displaying user information in UI
- Updating user profile
- Storing user preferences and settings

#### When to Use Which

- **Use `User`** when you only need authentication info (checking if logged in, getting user ID for queries)
- **Use `UserProfile`** when you need full profile data (displaying name, goal, position, or other profile information)

**Note:** `UserSchema` in `firestore/schemas/user.schema.ts` is the authoritative schema for Firestore documents and includes all fields including technical fields (FCM tokens, notification permissions, etc.) and custom fields.

---

## 🏗️ Document Creation Lifecycle

### User & Boss Document Creation

BossUp creates User and Boss documents through **two explicit paths**, ensuring no race conditions or duplicate bosses.

#### Path 1: Web Funnel (with Onboarding Data)

**When:** User submits email in web funnel (discovery.ozma.io)  
**Where:** `web-funnels/app/api/firebase/create-user` API endpoint  
**Triggered:** Background (fire-and-forget) when user clicks "Continue" on email screen

**What gets created:**

1. **Firebase Auth User** (if doesn't exist)
   - Email normalized (lowercase, trimmed)
   - `emailVerified: false`
   - Firebase "one account per email" ensures no duplicates across providers

2. **User Document** (`/users/{userId}`)
   - `email`: from funnel
   - `createdAt`: timestamp
   - `name`, `goal`, `position`: empty (user fills later)
   - `custom_age`: from funnel question
   - `goal`: from funnel "mainGoal" question (core field)

3. **Boss Document** (`/users/{userId}/bosses/{bossId}`)
   - `name`: "My Boss" (placeholder)
   - `position`: "Manager" (placeholder)
   - `birthday`: "" (empty)
   - `managementStyle`: "" (empty)
   - `custom_bossAge`: from funnel
   - `custom_oneOnOne`: from funnel
   - `custom_bossCommunication`: from funnel
   - `custom_mistakesHandling`: from funnel

4. **Timeline Entries** (`/users/{userId}/entries/{entryId}`)
   - 29 timeline entries from funnel questions
   - Type: `'note'`, subtype: `'note'`
   - Source: `'onboarding_funnel'`
   - Examples: stress level, confidence, workload assessments

**Code location:**
```typescript
// web-funnels/app/api/firebase/create-user/route.ts
// Mapping: web-funnels/app/utils/firebaseUserMapper.ts
// Config: web-funnels/app/new-job/config.ts (dataDestination field)
```

#### Path 2: Direct App Registration (No Web Funnel)

**When:** User signs up via Apple/Google/Email directly in mobile app  
**Where:** `services/user.service.ts` → `ensureUserProfileExists()`  
**Triggered:** Automatically on first authentication (from `AuthContext`)

**What gets created:**

1. **User Document** (`/users/{userId}`)
   - `email`: from Firebase Auth
   - `createdAt`: timestamp
   - `name`, `goal`, `position`: empty strings (user fills during onboarding)

2. **Boss Document** (`/users/{userId}/bosses/{bossId}`)
   - `name`: "My Boss"
   - `position`: "Manager"
   - `birthday`: ""
   - `managementStyle`: ""
   - `startedAt`: timestamp
   - `createdAt`: timestamp
   - `updatedAt`: timestamp
   - `_fieldsMeta`: {}

**Code location:**
```typescript
// services/user.service.ts: ensureUserProfileExists()
// Called from: contexts/AuthContext.tsx line 95
```

#### Path 3: Safety Fallback (Edge Cases)

**When:** Boss doesn't exist when user opens Boss/Timeline screen  
**Where:** `hooks/useBoss.ts` → `createBoss()`  
**Triggered:** On first screen load if no boss found

**Purpose:** Safety net that should rarely trigger. Ensures app never breaks if explicit creation fails.

**Monitoring:** Reports to Sentry with error level when triggered (should be unreachable in production)

**Code location:**
```typescript
// hooks/useBoss.ts: lines 57-83
// Creates: services/boss.service.ts: createBoss()
// Reports: logger.error() sends to Sentry for monitoring
```

### Chat Thread Creation

**When:** User document is created (any path)  
**Where:** Handled synchronously during user creation  
**Files:** 
- `web-funnels/app/api/firebase/create-user/route.ts` → `createChatWithWelcomeMessage()` (web funnel path)
- `services/user.service.ts` → `createChatWithWelcomeMessage()` (direct app path)

**What gets created:**
- Chat thread: `/users/{userId}/chatThreads/main`
- Welcome message from AI assistant
- Thread metadata (unreadCount, lastMessageAt, etc.)

**Safety Fallback:** If thread doesn't exist when user opens chat (e.g., creation failed), it's created in `services/chat.service.ts` → `getOrCreateThread()`. This fallback reports to Sentry for monitoring.

**Important:** Chat creation is now synchronous to eliminate race conditions that occurred with the old `onUserCreated` Cloud Function trigger.

### Creation Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER REGISTRATION                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   Two Entry Points  │
                    └─────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
    ┌───────────────────────┐   ┌──────────────────────┐
    │    Web Funnel Path    │   │   Direct App Path    │
    │  (discovery.ozma.io)  │   │  (Apple/Google/Email)│
    └───────────────────────┘   └──────────────────────┘
                │                           │
                ▼                           ▼
    ┌───────────────────────┐   ┌──────────────────────┐
    │ Firebase Auth User    │   │ Firebase Auth User   │
    │ (if not exists)       │   │                      │
    └───────────────────────┘   └──────────────────────┘
                │                           │
                ▼                           ▼
    ┌───────────────────────┐   ┌──────────────────────┐
    │ User Doc              │   │ User Doc             │
    │ /users/{uid}          │   │ /users/{uid}         │
    │ + custom fields       │   │ (empty fields)       │
    │ + Chat Thread         │   │ + Chat Thread        │
    │   (synchronous)       │   │   (synchronous)      │
    └───────────────────────┘   └──────────────────────┘
                │                           │
                ▼                           ▼
    ┌───────────────────────┐   ┌──────────────────────┐
    │ Boss Doc              │   │ Boss Doc             │
    │ /users/{uid}/bosses/  │   │ /users/{uid}/bosses/ │
    │ + funnel data         │   │ (default values)     │
    └───────────────────────┘   └──────────────────────┘
                │                           │
                ▼                           │
    ┌───────────────────────┐               │
    │ Timeline Entries      │               │
    │ 29 note entries       │               │
    │ from funnel questions │               │
    └───────────────────────┘               │
                │                           │
                └───────────┬───────────────┘
                            ▼
                ┌───────────────────────┐
                │   User Opens App      │
                │   Boss Screen Loads   │
                │   ✅ Boss Exists      │
                └───────────────────────┘
```

### Key Design Decisions

**Why two explicit paths instead of one Cloud Function trigger?**

1. **Web funnel creates immediately** - No delay, user data saved instantly
2. **App registration creates explicitly** - No race condition with web funnel
3. **No automatic trigger** - Prevents duplicate boss creation
4. **Clear separation** - Easy to understand where boss comes from

**Why safety fallbacks (boss and chat thread)?**

- Edge case protection if explicit creation paths fail
- Ensures app never breaks with "No data found" errors
- **Reports to Sentry** when triggered for monitoring and investigation
- Should rarely/never trigger in production (unreachable code)
- Allows us to detect and fix root causes (Cloud Function failures, race conditions, etc.)

**Web funnel users linking to existing Auth accounts:**

- Firebase "one account per email" setting automatically links credentials
- Web funnel creates Auth user with email (unverified)
- User later signs in with Apple/Google → same email → same Auth UID
- User sees their web funnel data immediately (boss, entries, etc.)

### Schema Versioning

Each schema has a version number:

```typescript
export const USER_SCHEMA_VERSION = 3;
export const BOSS_SCHEMA_VERSION = 2;
export const ENTRY_SCHEMA_VERSION = 4;
```

Increment this when making breaking changes. Optionally store version in documents:

```typescript
{
  ...bossData,
  _schemaVersion: BOSS_SCHEMA_VERSION
}
```

---

## 🎯 Dynamic Custom Fields

BossUp uses a **minimal core + dynamic custom fields** architecture.

📖 **For complete documentation, see [dynamic-fields-system.md](./dynamic-fields-system.md)**

### Core Concept

**Three types of fields:**

1. **Core Fields** - Cannot be deleted (email, name, createdAt, etc.)
2. **Technical Fields** - System-managed (fcmToken, attribution, etc.)
3. **Custom Fields** - User-deletable business data (all with `custom_` prefix)

### Custom Fields Pattern

All business data uses the `custom_` prefix:

```typescript
{
  // Core fields
  name: "Sarah Johnson",
  position: "CTO",
  createdAt: "2025-01-15T10:00:00Z",
  
  // Custom fields (deletable)
  custom_age: "35-44",
  custom_oneOnOne: "Every 2 weeks",
  custom_availability: "Sometimes available",
  
  // Field metadata
  _fieldsMeta: {
    custom_age: {
      label: "Boss Age",
      type: "select",
      category: "Demographics",
      source: "onboarding_funnel",
      createdAt: "2025-01-15T10:00:00Z",
      options: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
    },
    custom_oneOnOne: {
      label: "One-on-One Meetings",
      type: "select",
      category: "Communication",
      source: "onboarding_funnel",
      createdAt: "2025-01-15T10:00:00Z"
    }
  }
}
```

### Required Fields

**User:** `email`, `createdAt`  
**Boss:** `name`, `position`, `department`, `startedAt`, `createdAt`, `updatedAt`

Protected by Firestore security rules.

### Adding Custom Fields

```typescript
import { updateDoc, doc } from 'firebase/firestore';

await updateDoc(bossRef, {
  custom_petName: "Max",
  [`_fieldsMeta.custom_petName`]: {
    label: "Pet Name",
    type: "text",
    category: "Personal",
    source: "user_added",
    createdAt: new Date().toISOString()
  },
  updatedAt: new Date().toISOString()
});
```

### Removing Custom Fields

```typescript
import { updateDoc, deleteField } from 'firebase/firestore';

await updateDoc(bossRef, {
  custom_petName: deleteField(),
  [`_fieldsMeta.custom_petName`]: deleteField(),
  updatedAt: new Date().toISOString()
});
```

### Field Presets

Pre-configured fields for web funnel integration:

```typescript
import { BOSS_FUNNEL_FIELD_PRESETS } from '@/firestore/schemas/field-presets';

// Get preset configuration
const preset = BOSS_FUNNEL_FIELD_PRESETS.custom_oneOnOne;
// { label: "One-on-One Meetings", type: "select", category: "Communication", options: [...] }
```

---

## 📝 Timeline Entries

Timeline entries are text-based events with subtypes that help organize different kinds of information.

### Entry Types and Subtypes

All timeline entries use `type: 'note'` with one of the following subtypes:
- `note` - General observations and assessments
   - `interaction` - Meeting/call/communication logs
   - `feedback` - Feedback from boss
   - `achievement` - Successes and milestones
   - `challenge` - Problems and conflicts
   - `other` - Anything else

### Base Fields (Common to all entries)

```typescript
{
  id: string,
  timestamp: string,
  title: string,
  content: string,
  icon?: string,
  source?: 'onboarding_funnel' | 'user_added' | 'ai_added',
  createdAt?: string,
  updatedAt?: string
}
```

### NoteEntry Schema

```typescript
{
  type: 'note',
  subtype: 'note' | 'interaction' | 'feedback' | 'achievement' | 'challenge' | 'other',
  // + all base fields
}
```

### Example: Creating a Note Entry

```typescript
import { addDoc, collection } from 'firebase/firestore';

const entriesRef = collection(db, 'users', userId, 'entries');

await addDoc(entriesRef, {
  type: 'note',
  subtype: 'feedback',
  timestamp: new Date().toISOString(),
  title: 'Positive feedback on presentation',
  content: 'Boss praised my project presentation. She mentioned I explained technical concepts clearly.',
  icon: '👍',
  source: 'user_added',
  createdAt: new Date().toISOString()
});
```

### Example: Recording Assessment from Funnel

```typescript
await addDoc(entriesRef, {
  type: 'note',
  subtype: 'note',
  timestamp: new Date().toISOString(),
  title: 'Stress Level',
  content: 'Quite stressful',
    source: 'onboarding_funnel',
    createdAt: new Date().toISOString()
  });
```

---

## 🔄 Data Migrations

### When You Need Migrations

| Change | Need Migration? | Strategy |
|--------|----------------|----------|
| Add optional field | ❌ No | Just start using it in code |
| Add required field | ✅ Yes | Backfill existing documents |
| Remove field | ❌ No | Stop reading it, clean up later |
| Rename field | ✅ Yes | Copy old → new, delete old |
| Change type | ✅ Yes | Transform data format |

### Creating a Migration

1. Create file: `firestore/migrations/YYYY-MM-DD-description.ts`

```typescript
export const migration = {
  name: '2025-11-07-add-avatar-field',
  description: 'Add avatarUrl to boss documents',
  date: '2025-11-07',
  author: 'your-name',
  
  async up(db: Firestore) {
    // Migration logic
  },
  
  async down(db: Firestore) {
    // Rollback (optional)
  },
};
```

2. See `firestore/migrations/examples/` for patterns

### Running Migrations

```bash
cd firestore/migrations

# Install dependencies (first time only)
npm install

# Run migration
npm run migrate -- 2025-11-07-add-avatar-field

# Dry run (no changes)
npm run migrate -- 2025-11-07-add-avatar-field --dry-run

# In CI/CD (skip confirmation)
npm run migrate -- 2025-11-07-add-avatar-field --yes
```

### Migration Best Practices

1. ✅ **Test on staging first** - Never run directly on production
2. ✅ **Batch operations** - Process documents in batches (500 at a time)
3. ✅ **Idempotent** - Safe to run multiple times
4. ✅ **Logging** - Log progress and errors clearly
5. ✅ **Backup** - Export Firestore before major changes
6. ✅ **Rollback plan** - Implement `down()` function

---

## 📈 Indexes

### What Are Indexes?

Indexes improve query performance. Firestore automatically creates indexes for:
- Single field queries
- Simple equality filters

You need **composite indexes** for:
- Multiple field queries
- Sorting + filtering
- Range queries on multiple fields

### Creating Indexes

#### Method 1: From Console (Easiest)

1. Run your query in the app
2. Check error message in console
3. Click the link to create index automatically

#### Method 2: Define in Code

Edit `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "entries",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "timestamp", "mode": "DESCENDING" },
        { "fieldPath": "type", "mode": "ASCENDING" }
      ]
    }
  ]
}
```

📖 **See [firebase-deployment.md](./firebase-deployment.md) for deployment instructions**

---

## 🔧 CLI Commands

### Testing Locally

```bash
# Start Firestore emulator
firebase emulators:start --only firestore

# Start with data
firebase emulators:start --import=./emulator-data

# Export data after testing
firebase emulators:export ./emulator-data
```

### Firestore Operations

```bash
# Export data (backup)
firebase firestore:export gs://your-bucket/backups/2025-11-07

# Import data (restore)
firebase firestore:import gs://your-bucket/backups/2025-11-07
```

📖 **For full deployment and CLI commands, see [firebase-deployment.md](./firebase-deployment.md)**

---

## 📦 Best Practices Summary

### Schema Management

1. ✅ Define schemas in `firestore/schemas/`
2. ✅ Use TypeScript types everywhere
3. ✅ Version your schemas
4. ✅ Document default values
5. ✅ Keep schemas in sync with types/index.ts

### Security

1. ✅ Never allow `if true` in production
2. ✅ Always validate `request.auth.uid`
3. ✅ Test rules with emulator
4. ✅ Use helper functions for complex logic
5. ✅ Keep rules in version control

### Migrations

1. ✅ Store migration scripts in git
2. ✅ Test on staging before production
3. ✅ Log everything
4. ✅ Make migrations idempotent
5. ✅ Have rollback plan

### Performance

1. ✅ Create indexes for complex queries
2. ✅ Batch write operations
3. ✅ Use pagination (limit + startAfter)
4. ✅ Denormalize data when needed
5. ✅ Monitor quota usage

### Version Control

Everything in git:
- ✅ `firestore.rules` - Security rules
- ✅ `firestore.indexes.json` - Indexes
- ✅ `firestore/schemas/` - Type definitions
- ✅ `firestore/migrations/` - Migration scripts
- ✅ `firebase.json` - Configuration
- ✅ `.firebaserc` - Project aliases

❌ Never commit:
- `node_modules/`
- Service account keys (`.json` files)
- `.env` files with secrets

---

## 🆘 Troubleshooting

### "Firestore API not enabled"

```bash
# The init command should have enabled it, but if not:
firebase firestore:databases:create --region=us-central1
```

### "Permission denied"

- Check `firestore.rules`
- Verify user is authenticated
- Confirm `request.auth.uid` matches `userId` in path

### "Index required"

- Click the link in error message, or
- Add index to `firestore.indexes.json` and deploy

### Migration fails

1. Check logs for specific error
2. Run with `--dry-run` to debug
3. Use Firestore emulator for testing
4. Verify Firebase Admin SDK credentials

---

## 💳 Subscription System

BossUp uses a scalable subscription system that supports multiple tiers and billing periods.

### Architecture

**User Subscription Data (Firestore):**
- Stored in `/users/{userId}/subscription`
- Contains user's active subscription details
- Tracks status, tier, billing period, payment provider
- Supports Apple, Google Play, and Stripe

**Subscription Plans Configuration (Remote Config):**
- Plans defined in `remoteconfig.template.json`
- Deployed to Firebase Remote Config
- Can be updated without app release
- Currently only 'basic' tier available (pro, ultra, enterprise planned for future)

### Current Plans

All plans are for the 'basic' tier: Monthly, Quarterly, Semiannual, and Annual.

> **Note:** For current pricing, billing periods, trial details, savings, and Product IDs, see `constants/subscriptionPlans.ts` or `remoteconfig.template.json`

### User Subscription Schema

```typescript
subscription?: {
  status: 'none' | 'active' | 'trial' | 'cancelled' | 'expired' | 'grace_period';
  tier?: 'basic' | 'pro' | 'ultra' | 'enterprise';
  billingPeriod?: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  provider: 'none' | 'stripe' | 'apple' | 'google';
  
  // Dates
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEnd?: string;
  
  // Provider-specific fields
  appleProductId?: string;
  googlePlayProductId?: string;
  stripeCustomerId?: string;
  
  // Price info
  priceAmount?: number;
  priceCurrency?: string;
  billingCycleMonths?: number;
}
```

### Deployment

**Update subscription plans:**

```bash
# Edit remoteconfig.template.json
# Then deploy:
firebase deploy --only remoteconfig
```

**Plans are versioned in git** - all changes to pricing go through code review.

### Important Notes

- **Apple Review Compliance**: Stripe subscriptions are hidden in iOS app UI
- **Firebase as Source of Truth**: All subscription data stored in Firestore
- **Only Basic tier**: Pro/Ultra tiers are in schema but not yet implemented
- **Multi-platform**: Supports Apple, Google Play, and Stripe payment providers

---

## 📚 Resources

- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Security Rules Guide](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Best Practices](https://firebase.google.com/docs/firestore/best-practices)

---

## 🎯 Quick Start Guide

**Setup steps:**
1. Install Firebase CLI
2. Initialize Firestore
3. Set up security rules
4. Create schema definitions
5. Set up migration system
6. Deploy Firestore (see [firebase-deployment.md](./firebase-deployment.md))
7. Create migrations as needed
8. Set up CI/CD for automatic deployment

Need help? Check the individual READMEs in each directory!

