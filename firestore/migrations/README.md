# Firestore Data Migrations

Migration scripts for transforming existing Firestore data.

## When Do You Need Migrations?

❌ **Don't need migrations for:**
- Adding new optional fields
- Removing fields

✅ **Need migrations for:**
- Renaming fields
- Changing field types
- Restructuring data
- Backfilling required fields

## Running Migrations

```bash
cd firestore/migrations

# Install dependencies (first time only)
npm install

# Run migration
npm run migrate -- YYYY-MM-DD-migration-name

# Dry run (no changes)
npm run migrate -- YYYY-MM-DD-migration-name --dry-run
```

## Creating Migrations

**Naming:** `YYYY-MM-DD-description.ts`

**Examples:** See `examples/` directory

📖 **For detailed migration guide, best practices, and examples, see [docs/firestore-management.md](../../docs/firestore-management.md)**

