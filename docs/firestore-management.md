# Firestore Management Guide

Complete guide for managing Firestore database, security rules, migrations, and schemas.

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
  
  // All subcollections inherit the same rule
  match /bosses/{bossId} {
    allow read, write: if request.auth.uid == userId;
    
    match /entries/{entryId} {
      allow read, write: if request.auth.uid == userId;
    }
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

```bash
# Deploy rules to production
firebase deploy --only firestore:rules

# Deploy to specific environment
firebase use staging
firebase deploy --only firestore:rules
```

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

### Schema Versioning

Each schema has a version number:

```typescript
export const BOSS_SCHEMA_VERSION = 1;
```

Increment this when making breaking changes. Optionally store version in documents:

```typescript
{
  ...bossData,
  _schemaVersion: BOSS_SCHEMA_VERSION
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

Then deploy:

```bash
firebase deploy --only firestore:indexes
```

---

## 🚀 Deployment

### Deploy Everything

```bash
firebase deploy
```

### Deploy Specific Resources

```bash
# Security rules only
firebase deploy --only firestore:rules

# Indexes only
firebase deploy --only firestore:indexes

# Both
firebase deploy --only firestore
```

### Multi-Environment Setup

```bash
# Add environments
firebase use --add

# Switch environment
firebase use staging
firebase use production

# Deploy to specific env
firebase use staging && firebase deploy
```

---

## 🔧 CLI Commands

### Project Management

```bash
# List projects
firebase projects:list

# Switch project
firebase use the-boss-app-e42b6

# Current project
firebase use
```

### Firestore Operations

```bash
# Export data
firebase firestore:export gs://your-bucket/backups/2025-11-07

# Import data
firebase firestore:import gs://your-bucket/backups/2025-11-07

# Delete all data (DANGEROUS!)
firebase firestore:delete --all-collections
```

### Emulator

```bash
# Start emulator
firebase emulators:start

# Start with data
firebase emulators:start --import=./emulator-data

# Export data after testing
firebase emulators:export ./emulator-data
```

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

## 📚 Resources

- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Security Rules Guide](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Best Practices](https://firebase.google.com/docs/firestore/best-practices)

---

## 🎯 Quick Start Checklist

- [x] Install Firebase CLI
- [x] Initialize Firestore (`firebase init firestore`)
- [x] Set up security rules
- [x] Create schema definitions
- [x] Set up migration system
- [ ] Deploy rules: `firebase deploy --only firestore:rules`
- [ ] Create first migration (if needed)
- [ ] Set up CI/CD for automatic deployment
- [ ] Configure staging environment

Need help? Check the individual READMEs in each directory!

