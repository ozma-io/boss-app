# Firestore Data Schemas

This directory contains TypeScript schemas that define the structure of Firestore documents.

## Philosophy

Firestore is **schemaless**, but we enforce schemas at the **application level** through TypeScript types.

## Benefits

1. **Type Safety** - TypeScript catches errors at compile time
2. **Documentation** - Types serve as living documentation
3. **Validation** - Runtime validation through Zod/Yup (optional)
4. **Version Control** - All schemas tracked in git

## Schema Files

- `user.schema.ts` - User document structure
- `boss.schema.ts` - Boss document structure  
- `entry.schema.ts` - Timeline entry structures (notes, surveys, interactions)

## Usage

```typescript
import { UserSchema, BossSchema } from '@/firestore/schemas';

// When writing to Firestore
const newBoss: BossSchema = {
  name: 'John Doe',
  position: 'CTO',
  // ... TypeScript will enforce all required fields
};
```

## Migration Strategy

Since Firestore is schemaless, "migrations" are actually data transformations:

1. **Add new field** - Just start using it (default values in code)
2. **Remove field** - Stop reading it (leave old data as-is or clean up via script)
3. **Rename field** - Write migration script to transform documents
4. **Change type** - Write migration script + update code

See `/firestore/migrations/` for examples.

