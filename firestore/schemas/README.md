# Firestore Data Schemas

TypeScript schemas that define the structure of Firestore documents.

## Schema Files

- `user.schema.ts` - User document structure
- `boss.schema.ts` - Boss document structure  
- `entry.schema.ts` - Timeline entry structures (notes, surveys, interactions)
- `index.ts` - Exports all schemas

## Usage

```typescript
import { BossSchema, BossDefaults } from '@/firestore/schemas';

const newBoss: BossSchema = {
  ...BossDefaults,
  name: 'John Doe',
  position: 'CTO',
};
```

📖 **For detailed information about schemas, migrations, and best practices, see [docs/firestore-management.md](../../docs/firestore-management.md)**

