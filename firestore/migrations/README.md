# Firestore Data Migrations

This directory contains migration scripts for transforming existing Firestore data.

## When Do You Need Migrations?

Firestore is schemaless, so you DON'T need migrations for:

- ✅ **Adding new optional fields** - Just start using them in code
- ✅ **Adding default values** - Handle in application code
- ✅ **Removing fields** - Just stop reading them

You DO need migration scripts for:

- ⚠️ **Renaming fields** - Transform existing documents
- ⚠️ **Changing field types** - Convert data format
- ⚠️ **Restructuring data** - Moving data between collections
- ⚠️ **Backfilling required fields** - Add data to existing documents

## Migration Scripts

Each migration is a standalone TypeScript file with:
1. **Description** - What it does
2. **Date** - When created
3. **Author** - Who created it
4. **Up function** - Applies the migration
5. **Down function** - (Optional) Reverts the migration

## Naming Convention

```
YYYY-MM-DD-description.ts
```

Examples:
- `2025-11-07-add-boss-avatar-field.ts`
- `2025-12-15-migrate-notification-settings.ts`

## Running Migrations

Migrations use Firebase Admin SDK and run server-side (not in the app).

### Prerequisites

```bash
cd firestore/migrations
npm install
```

### Run a migration

```bash
npm run migrate -- 2025-11-07-add-boss-avatar-field
```

### Dry run (no changes)

```bash
npm run migrate -- 2025-11-07-add-boss-avatar-field --dry-run
```

## Best Practices

1. **Test on staging first** - Never run migrations directly on production
2. **Batch operations** - Process documents in batches (e.g., 500 at a time)
3. **Idempotent** - Safe to run multiple times
4. **Logging** - Log progress and errors
5. **Backup** - Export Firestore backup before major migrations
6. **Rollback plan** - Always have a way to undo changes

## Example Migration Structure

```typescript
// 2025-11-07-example.ts
export const migration = {
  name: '2025-11-07-example',
  description: 'Add avatarUrl field to all bosses',
  date: '2025-11-07',
  author: 'your-name',
  
  async up(db: Firestore) {
    // Migration logic here
  },
  
  async down(db: Firestore) {
    // Rollback logic here (optional)
  },
};
```

## Common Migration Patterns

See example files in this directory:
- `examples/add-field.ts` - Add new field to documents
- `examples/rename-field.ts` - Rename existing field
- `examples/change-type.ts` - Change field data type
- `examples/restructure.ts` - Move data between collections

