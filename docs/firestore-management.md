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

### Schema Versioning

Each schema has a version number:

```typescript
export const USER_SCHEMA_VERSION = 3;
export const BOSS_SCHEMA_VERSION = 2;
export const ENTRY_SCHEMA_VERSION = 2;
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

## 📈 FactEntry Pattern

**FactEntry** is a new entry type for tracking single assessments that change over time.

### When to Use FactEntry

Use FactEntry for:
- Frequently changing states (stress level, mood)
- Time-series assessments (weekly confidence check-ins)
- Historical tracking (how workload changed over time)

Don't use for:
- Stable characteristics (store in User/Boss document)
- One-time events (use Note or Interaction entry)

### Timeline Entry Types

BossUp uses two technical entry types:

1. **`note`** - Text-based entries with subtypes:
   - `note` - General observations
   - `interaction` - Meeting/call/communication logs
   - `feedback` - Feedback from boss
   - `achievement` - Successes and milestones
   - `challenge` - Problems and conflicts
   - `other` - Anything else

2. **`fact`** - Single data points for measurements

### Base Fields (Common to all entries)

```typescript
{
  id: string,
  timestamp: string,
  title: string,               // Required (display name for the entry)
  content: string,             // Required (empty string by default for facts)
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

### FactEntry Schema

```typescript
{
  type: 'fact',
  factKey: string,             // e.g., "custom_stressLevel"
  value: string | number | string[],
  // + all base fields (title is the display name, e.g., "Stress Level")
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
  createdAt: new Date().toISOString()
});
```

### Example: Recording Stress Level (User Input)

```typescript
import { addDoc, collection } from 'firebase/firestore';

const entriesRef = collection(db, 'users', userId, 'entries');

await addDoc(entriesRef, {
  type: 'fact',
  timestamp: new Date().toISOString(),
  factKey: 'custom_stressLevel',
  title: 'Stress Level',
  value: 'Quite stressful',
  content: '',
  source: 'user_added',
  createdAt: new Date().toISOString()
});
```

### Example: AI-Generated Fact with Context

```typescript
await addDoc(entriesRef, {
  type: 'fact',
  timestamp: new Date().toISOString(),
  factKey: 'custom_confidenceLevel',
  title: 'Confidence Level',
  value: 'High',
  content: 'Based on recent achievements and positive feedback from the boss.',
  source: 'ai_added',
  icon: '🤖',
  createdAt: new Date().toISOString()
});
```

### Querying Facts

```typescript
import { query, collection, where, orderBy, getDocs } from 'firebase/firestore';

// Get all stress level assessments, most recent first
const q = query(
  collection(db, 'users', userId, 'entries'),
  where('type', '==', 'fact'),
  where('factKey', '==', 'custom_stressLevel'),
  orderBy('timestamp', 'desc')
);

const snapshot = await getDocs(q);
snapshot.forEach(doc => {
  const fact = doc.data();
  console.log(`${fact.timestamp}: ${fact.value}`);
});
```

### Web Funnel Integration

When user completes funnel, create separate FactEntry for each assessment:

```typescript
const timelineFacts = [
  { key: 'custom_stressLevel', label: 'Stress Level', value: 'Quite stressful', category: 'Emotions' },
  { key: 'custom_confidenceLevel', label: 'Confidence Level', value: 'Often doubt myself', category: 'Emotions' },
  { key: 'custom_workload', label: 'Workload', value: 'Sometimes overloaded', category: 'Workload' },
];

for (const fact of timelineFacts) {
  await addDoc(entriesRef, {
    type: 'fact',
    timestamp: new Date().toISOString(),
    factKey: fact.key,
    factLabel: fact.label,
    value: fact.value,
    category: fact.category,
    source: 'onboarding_funnel',
    createdAt: new Date().toISOString()
  });
}
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

