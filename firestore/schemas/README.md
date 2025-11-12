# Firestore Data Schemas

TypeScript schemas that define the structure of Firestore documents.

## Schema Files

- `user.schema.ts` - User document structure
- `boss.schema.ts` - Boss document structure  
- `entry.schema.ts` - Timeline entry structures (notes, surveys, interactions, facts)
- `index.ts` - Exports all schemas

## Data Organization Principle

**Timeline (Entries)** — frequently changing data (daily/weekly assessments):
- Current mood, stress level today, confidence this week
- Use `FactEntry` type for trackable metrics that change over time
- Examples: daily stress assessment, weekly confidence check-in

**User/Boss Documents** — stable characteristics (rarely change):
- Position, department, goal, communication preferences, working hours
- Store as fields directly in User or Boss documents
- Examples: job title, team, career goal, boss's management style

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

