# Scripts

Automation scripts for project management.

## Available Scripts

### `setup-firestore.sh`

Automatically set up Firestore database with security rules and indexes.

**Usage:**
```bash
./scripts/setup-firestore.sh
```

**What it does:**
- Creates Firestore database (if needed)
- Deploys security rules
- Deploys indexes

**When to use:**
- First time project setup
- Setting up new environment

📖 **For detailed Firebase deployment instructions, see [docs/firebase-deployment.md](../docs/firebase-deployment.md)**

