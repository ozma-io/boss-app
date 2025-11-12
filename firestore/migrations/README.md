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

**Run from project root** (where `.env` file is located):

```bash
npx tsx firestore/migrations/run-migration.ts YYYY-MM-DD-migration-name --yes
```

## Creating Migrations

**Naming:** `YYYY-MM-DD-description.ts`

**Examples:** See `examples/` directory

📖 **For detailed migration guide, best practices, and examples, see [docs/firestore-management.md](../../docs/firestore-management.md)**

