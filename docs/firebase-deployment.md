# Firebase Deployment Guide

Complete guide for deploying and managing Firebase resources.

---

## 📋 Prerequisites

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Verify project
firebase use
```

---

## 🚀 Initial Setup

### First-Time Firestore Setup

Run the setup script to create database, deploy rules and indexes:

```bash
./scripts/setup-firestore.sh
```

**What it does:**
1. Checks if Firestore database exists
2. Creates database in us-central1 (if needed)
3. Deploys security rules from `firestore.rules`
4. Deploys indexes from `firestore.indexes.json`

---

## 🔥 Cloud Functions Deployment

### Build and Deploy

```bash
# Build TypeScript
cd functions && npm run build

# Deploy all functions
cd .. && firebase deploy --only functions

# First-time deploy or force cleanup policy setup
firebase deploy --only functions --force
```

### Service Account Permissions

**Important:** Cloud Functions 2nd gen needs permission to create custom tokens.

```bash
# Get your project number
gcloud projects describe the-boss-app-e42b6 --format="value(projectNumber)"

# Grant permission (replace PROJECT_NUMBER with the number from above)
gcloud iam service-accounts add-iam-policy-binding PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project=the-boss-app-e42b6
```

This is required **once per project** for test user authentication to work.

### View Logs

```bash
cd functions && npm run logs
```

---

## 🗄️ Firestore Deployment

### Security Rules

```bash
# Deploy rules only
firebase deploy --only firestore:rules

# Test rules locally first
firebase emulators:start --only firestore
```

**Security rules location:** `firestore.rules`

### Indexes

```bash
# Deploy indexes only
firebase deploy --only firestore:indexes
```

**Indexes location:** `firestore.indexes.json`

**Creating indexes:**
1. Run query in app → get error with link
2. Click link to auto-create index, OR
3. Add manually to `firestore.indexes.json` and deploy

### Both Rules and Indexes

```bash
firebase deploy --only firestore
```

---

## 🔄 Data Migrations

**Location:** `firestore/migrations/`

**Detailed guide:** See `firestore/migrations/README.md`

```bash
cd firestore/migrations

# Install dependencies (first time only)
npm install

# Run migration
npm run migrate -- YYYY-MM-DD-migration-name

# Dry run (no changes)
npm run migrate -- YYYY-MM-DD-migration-name --dry-run
```

**Best practices:**
- ✅ Test on staging first
- ✅ Batch operations (500 docs at a time)
- ✅ Make migrations idempotent
- ✅ Backup before major changes

---

## 🌍 Multi-Environment Setup

### Configure Environments

```bash
# Add new environment
firebase use --add

# List projects
firebase projects:list

# Switch environment
firebase use staging
firebase use production
```

**Project aliases stored in:** `.firebaserc`

### Deploy to Specific Environment

```bash
# Switch and deploy
firebase use staging && firebase deploy

# Deploy specific resources to staging
firebase use staging && firebase deploy --only functions
```

---

## 📦 Deploy Everything

```bash
# Deploy all Firebase resources
firebase deploy

# What gets deployed:
# - Cloud Functions
# - Firestore Rules
# - Firestore Indexes
# - Hosting (if configured)
```

---

## 🔧 Useful Commands

### Project Management

```bash
# Current project
firebase use

# Switch project
firebase use the-boss-app-e42b6

# List all projects
firebase projects:list
```

### Firestore Data Operations

```bash
# Export data (backup)
firebase firestore:export gs://your-bucket/backups/2025-11-07

# Import data (restore)
firebase firestore:import gs://your-bucket/backups/2025-11-07

# Delete all data (DANGEROUS! Use with caution)
firebase firestore:delete --all-collections
```

### Emulator (Local Testing)

```bash
# Start all emulators
firebase emulators:start

# Start with existing data
firebase emulators:start --import=./emulator-data

# Export data after testing
firebase emulators:export ./emulator-data

# Start specific emulators
firebase emulators:start --only firestore,auth,functions
```

---

## 🎯 Deployment Checklist

### Before Deploying to Production

**Pre-deployment steps:**
1. Test changes locally with emulators
2. Deploy to staging environment first
3. Run integration tests
4. Backup Firestore data (if modifying data)
5. Review security rules changes
6. Check Cloud Functions quota/pricing
7. Verify environment variables are set correctly

### Deployment Steps

```bash
# 1. Build Cloud Functions
cd functions && npm run build && cd ..

# 2. Deploy to staging
firebase use staging && firebase deploy

# 3. Test staging
# ... run tests ...

# 4. Deploy to production
firebase use production && firebase deploy

# 5. Monitor logs
cd functions && npm run logs
```

---

## ❌ Common Issues

### "Firestore API not enabled"

```bash
firebase firestore:databases:create --region=us-central1
```

### "Permission denied" for Cloud Functions

Check that service account has `roles/iam.serviceAccountTokenCreator` role (see above).

### "Index required"

Click the link in error message, or add to `firestore.indexes.json` and deploy.

### Functions deployment fails

```bash
# Check build errors
cd functions && npm run build

# Try force deploy
firebase deploy --only functions --force

# Check quota limits in Firebase Console
```

---

## 📚 Related Documentation

- **Firestore management:** See `docs/firestore-management.md`
- **Migrations:** See `firestore/migrations/README.md`
- **Scripts:** See `scripts/README.md`
- **Firebase CLI:** https://firebase.google.com/docs/cli

---

## 🔐 Security Notes

### Never Commit

- ❌ Service account keys (`.json` files)
- ❌ `.env` files with secrets
- ❌ Firebase config with actual API keys (use environment variables)

### Always in Git

- ✅ `firestore.rules`
- ✅ `firestore.indexes.json`
- ✅ `firebase.json`
- ✅ `.firebaserc` (project aliases only, no secrets)
- ✅ Cloud Functions source code

---

## 🆘 Need Help?

- Firebase Console: https://console.firebase.google.com/
- Firebase Documentation: https://firebase.google.com/docs
- Firebase CLI Reference: https://firebase.google.com/docs/cli
- Cloud Functions Docs: https://firebase.google.com/docs/functions

