# Scripts

Automation scripts for project management.

## Available Scripts

### `setup-firestore.sh`

**Purpose:** Automatically set up Firestore database with security rules and indexes.

**Usage:**
```bash
./scripts/setup-firestore.sh
```

**What it does:**
1. Checks if Firestore database exists
2. Creates database in us-central1 (if needed)
3. Deploys security rules from `firestore.rules`
4. Deploys indexes from `firestore.indexes.json`

**When to use:**
- First time project setup
- After modifying `firestore.rules` or `firestore.indexes.json`
- When setting up new environment (staging/production)

**Requirements:**
- Firebase CLI installed (`npm install -g firebase-tools`)
- Logged in to Firebase (`firebase login`)
- Correct project selected (`firebase use the-boss-app-e42b6`)

---

## Adding New Scripts

When creating new automation scripts:

1. Place them in this directory (`scripts/`)
2. Make them executable: `chmod +x scripts/your-script.sh`
3. Document them in this README
4. Add appropriate error handling (`set -e`)
5. Add descriptive output messages

