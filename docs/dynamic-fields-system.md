# Dynamic Fields System

Complete guide to the dynamic custom fields system in BossUp.

---

## Overview

BossUp uses a **minimal core + dynamic custom fields** architecture. This allows:
- System fields that cannot be deleted (email, name, etc.)
- Business data fields that users can freely add/remove
- Web funnel data seamlessly integrated as custom fields
- No distinction between funnel-created and user-created fields

---

## Core Philosophy

### Three Types of Fields

1. **Core Fields** (Cannot be deleted)
   - System-critical fields required for app operation
   - Example: `email`, `name`, `createdAt`
   - Protected by Firestore security rules

2. **Technical Fields** (System-managed)
   - App infrastructure fields
   - Example: `fcmToken`, `notificationPermissionStatus`, `attribution`
   - Not user-editable

3. **Custom Fields** (User-deletable business data)
   - All business/relationship/assessment data
   - Prefix: `custom_` (e.g., `custom_age`, `custom_goal`)
   - Metadata stored in `_fieldsMeta`
   - Fully deletable by user

### Key Principle

**"No distinction between funnel and user data"**

Whether a field comes from the web funnel or is added by the user in the app, it's treated identically. All custom fields:
- Use the `custom_` prefix
- Have metadata in `_fieldsMeta`
- Can be deleted by the user
- Are optional (backward compatible)

---

## Data Distribution

### When to Store Where

**User Document**: Stable characteristics, traits that change rarely
- Demographics: age, position, department
- Long-term goals
- Career development assessments

**Boss Document**: Relationship patterns, characteristics of the boss
- Demographics: boss age
- Communication patterns: availability, style
- Feedback patterns: frequency, clarity
- Expectations clarity

**Timeline (FactEntry)**: Current states, moods, assessments that change frequently
- Emotional states: stress, confidence
- Current workload assessment
- Team support feeling
- Daily/weekly check-ins

---

## Schema Details

### User Schema

**Core fields** (required: `email`, `createdAt`, `name`, `goal`, `position`):
```typescript
{
  email: string
  createdAt: string
  name: string
  goal: string
  position: string
  updatedAt?: string
  displayName?: string
  photoURL?: string
}
```

**Technical fields** (system-managed):
```typescript
{
  fcmToken?: string | null
  notificationPermissionStatus?: 'granted' | 'denied' | 'not_asked'
  trackingPermissionStatus?: 'authorized' | 'denied' | 'not_determined' | 'restricted'
  attribution?: { fbclid, utm_source, ... }
  subscription?: { status, plan, ... }
}
```

**Custom fields** (examples):
```typescript
{
  custom_age: "25-34"
  custom_department: "Engineering"
  custom_skillsMatch: "Have gaps"
  custom_whenStartedJob: "1-3 months ago"
}
```

### Boss Schema

**Core fields** (required: `name`, `position`, `birthday`, `managementStyle`, `startedAt`, `createdAt`, `updatedAt`):
```typescript
{
  name: string
  position: string
  birthday: string  // ISO 8601 date
  managementStyle: string
  startedAt: string  // ISO 8601
  createdAt: string
  updatedAt: string
  department?: string
  workingHours?: string
}
```

**Custom fields** (examples):
```typescript
{
  custom_age: "35-44"
  custom_oneOnOne: "Every 2 weeks"
  custom_availability: "Sometimes available"
  custom_communicationStyle: "Reserved"
  custom_feedbackClarity: "Sometimes have to guess"
}
```

### Entry Schema (Timeline)

**FactEntry** for frequently changing states:
```typescript
{
  type: 'fact'
  timestamp: string
  factKey: string        // e.g., "custom_stressLevel"
  factLabel: string      // e.g., "Stress Level"
  value: string | number | string[]
  category?: string      // e.g., "Emotions"
  source?: string        // e.g., "onboarding_funnel"
}
```

---

## Field Metadata (`_fieldsMeta`)

Every custom field must have metadata:

```typescript
{
  label: string           // Display name in UI
  type: 'text' | 'select' | 'date' | 'multiline' | 'multiselect'
  category?: string       // Grouping (Demographics, Communication, etc.)
  source?: string         // Where created (onboarding_funnel, user_added)
  createdAt: string       // ISO 8601 timestamp
  options?: string[]      // For select/multiselect types
}
```

**Example:**
```typescript
_fieldsMeta: {
  custom_age: {
    label: "Age",
    type: "select",
    category: "Demographics",
    source: "onboarding_funnel",
    createdAt: "2025-01-15T10:00:00Z",
    options: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
  },
  custom_petName: {
    label: "Pet Name",
    type: "text",
    category: "Personal",
    source: "user_added",
    createdAt: "2025-01-20T14:30:00Z"
  }
}
```

---

## Working with Custom Fields

### Creating a Custom Field

```typescript
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/services/firebase';

async function addCustomField(
  userId: string,
  bossId: string,
  fieldKey: string,
  fieldValue: any,
  metadata: FieldMetadata
) {
  const bossRef = doc(db, 'users', userId, 'bosses', bossId);
  
  await updateDoc(bossRef, {
    [fieldKey]: fieldValue,
    [`_fieldsMeta.${fieldKey}`]: {
      ...metadata,
      createdAt: new Date().toISOString()
    },
    updatedAt: new Date().toISOString()
  });
}

// Usage
await addCustomField(
  'user123',
  'boss456',
  'custom_petName',
  'Max',
  {
    label: 'Pet Name',
    type: 'text',
    category: 'Personal',
    source: 'user_added'
  }
);
```

### Removing a Custom Field

```typescript
import { updateDoc, deleteField } from 'firebase/firestore';

async function deleteCustomField(
  userId: string,
  bossId: string,
  fieldKey: string
) {
  // Check it's not a required field
  if (BOSS_REQUIRED_FIELDS.includes(fieldKey)) {
    throw new Error(`Cannot delete required field: ${fieldKey}`);
  }
  
  const bossRef = doc(db, 'users', userId, 'bosses', bossId);
  
  await updateDoc(bossRef, {
    [fieldKey]: deleteField(),
    [`_fieldsMeta.${fieldKey}`]: deleteField(),
    updatedAt: new Date().toISOString()
  });
}
```

### Rendering Custom Fields in UI

```typescript
function BossProfile({ boss }: { boss: BossSchema }) {
  // Get all custom fields
  const customFields = Object.keys(boss)
    .filter(key => key.startsWith('custom_'))
    .filter(key => key !== 'custom_');  // Skip if accidentally added
  
  return (
    <div>
      {/* Render core fields */}
      <h2>{boss.name}</h2>
      <p>{boss.position} at {boss.department}</p>
      
      {/* Render custom fields */}
      {customFields.map(fieldKey => {
        const meta = boss._fieldsMeta?.[fieldKey];
        const value = boss[fieldKey];
        
        return (
          <FieldDisplay
            key={fieldKey}
            label={meta?.label || fieldKey}
            value={value}
            type={meta?.type || 'text'}
            onDelete={() => deleteCustomField(userId, boss.id, fieldKey)}
          />
        );
      })}
    </div>
  );
}
```

---

## Web Funnel Integration

### Data Flow from Funnel to Firestore

When a user completes the web funnel:

**1. Update User with custom fields:**
```typescript
const userData = {
  email: "user@example.com",
  createdAt: new Date().toISOString(),
  name: "John Doe",
  goal: "Pass probation period",
  position: "Senior Developer",
  custom_age: "25-34",
  custom_department: "Engineering",
  _fieldsMeta: {
    custom_age: {
      label: "Age",
      type: "select",
      category: "Demographics",
      source: "onboarding_funnel",
      createdAt: new Date().toISOString(),
      options: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
    },
    custom_department: {
      label: "Department",
      type: "text",
      category: "Career",
      source: "onboarding_funnel",
      createdAt: new Date().toISOString()
    }
  }
};
```

**2. Create Boss with custom fields:**
```typescript
const bossData = {
  name: "Sarah Johnson",
  position: "CTO",
  birthday: "1980-05-15",
  managementStyle: "Collaborative",
  startedAt: "2024-10-01T00:00:00Z",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  department: "Engineering",
  custom_age: "35-44",
  custom_oneOnOne: "Every 2 weeks",
  custom_availability: "Sometimes available",
  _fieldsMeta: {
    custom_age: {
      label: "Boss Age",
      type: "select",
      category: "Demographics",
      source: "onboarding_funnel",
      createdAt: new Date().toISOString()
    },
    custom_oneOnOne: {
      label: "One-on-One Meetings",
      type: "select",
      category: "Communication",
      source: "onboarding_funnel",
      createdAt: new Date().toISOString()
    }
  }
};
```

**3. Create Timeline FactEntry documents:**
```typescript
// Create separate entry for each fact
const stressFactEntry = {
  type: 'fact',
  timestamp: new Date().toISOString(),
  factKey: 'custom_stressLevel',
  factLabel: 'Stress Level',
  value: 'Quite stressful',
  category: 'Emotions',
  source: 'onboarding_funnel',
  createdAt: new Date().toISOString()
};

const confidenceFactEntry = {
  type: 'fact',
  timestamp: new Date().toISOString(),
  factKey: 'custom_confidenceLevel',
  factLabel: 'Confidence Level',
  value: 'Often doubt myself',
  category: 'Emotions',
  source: 'onboarding_funnel',
  createdAt: new Date().toISOString()
};

// Add to timeline (entries are stored at user level)
await addDoc(
  collection(db, 'users', userId, 'entries'),
  stressFactEntry
);
await addDoc(
  collection(db, 'users', userId, 'entries'),
  confidenceFactEntry
);
```

### Using Field Presets

```typescript
import { USER_FUNNEL_FIELD_PRESETS, BOSS_FUNNEL_FIELD_PRESETS } from '@/firestore/schemas/field-presets';

// Get preset configuration
const agePreset = USER_FUNNEL_FIELD_PRESETS.custom_age;

// Create field with preset metadata
const fieldMeta = {
  label: agePreset.label,
  type: agePreset.type,
  category: agePreset.category,
  options: agePreset.options,
  source: 'onboarding_funnel',
  createdAt: new Date().toISOString()
};
```

---

## Security & Validation

### Firestore Security Rules

Required fields are protected:

```javascript
// User: email, createdAt, name, goal, position cannot be deleted
function hasRequiredUserFields(data) {
  return data.keys().hasAll(['email', 'createdAt', 'name', 'goal', 'position']);
}

// Boss: name, position, birthday, managementStyle, startedAt, createdAt, updatedAt cannot be deleted
function hasRequiredBossFields(data) {
  return data.keys().hasAll([
    'name', 'position', 'birthday', 'managementStyle', 'startedAt', 'createdAt', 'updatedAt'
  ]);
}
```

### Application-Level Validation

```typescript
import { USER_REQUIRED_FIELDS, BOSS_REQUIRED_FIELDS } from '@/firestore/schemas/field-presets';

function canDeleteField(documentType: 'user' | 'boss', fieldKey: string): boolean {
  if (documentType === 'user') {
    return !USER_REQUIRED_FIELDS.includes(fieldKey as any);
  }
  if (documentType === 'boss') {
    return !BOSS_REQUIRED_FIELDS.includes(fieldKey as any);
  }
  return true;
}
```

---

## Migration

Run migration to add `_fieldsMeta` to existing Boss documents:

```bash
cd firestore/migrations
npm install
npm run migrate -- 2025-01-15-add-fields-metadata

# Dry run (no changes)
npm run migrate -- 2025-01-15-add-fields-metadata --dry-run
```

The migration:
- Scans all Boss documents
- Finds fields starting with `custom_`
- Adds metadata entries if missing
- Never modifies field values
- Safe to run multiple times

---

## Best Practices

### 1. Always Use `custom_` Prefix for Business Data

✅ **Good:**
```typescript
{
  custom_age: "25-34",
  custom_goal: "Pass probation"
}
```

❌ **Bad:**
```typescript
{
  age: "25-34",        // Might conflict with core fields
  userGoal: "Pass probation"  // Not following convention
}
```

### 2. Always Add Metadata for Custom Fields

✅ **Good:**
```typescript
await updateDoc(bossRef, {
  custom_petName: "Max",
  [`_fieldsMeta.custom_petName`]: {
    label: "Pet Name",
    type: "text",
    category: "Personal",
    source: "user_added",
    createdAt: new Date().toISOString()
  }
});
```

❌ **Bad:**
```typescript
await updateDoc(bossRef, {
  custom_petName: "Max"  // Missing metadata!
});
```

### 3. Use Presets for Web Funnel Fields

✅ **Good:**
```typescript
import { BOSS_FUNNEL_FIELD_PRESETS } from '@/firestore/schemas/field-presets';

const preset = BOSS_FUNNEL_FIELD_PRESETS.custom_age;
const metadata = {
  ...preset,
  source: 'onboarding_funnel',
  createdAt: new Date().toISOString()
};
```

### 4. Check Before Deleting

✅ **Good:**
```typescript
if (BOSS_REQUIRED_FIELDS.includes(fieldKey)) {
  throw new Error('Cannot delete required field');
}
await updateDoc(bossRef, { [fieldKey]: deleteField() });
```

### 5. Use FactEntry for Time-Series Data

✅ **Good** (tracking changes over time):
```typescript
// Create new entry each time stress level changes
await addDoc(entriesRef, {
  type: 'fact',
  timestamp: new Date().toISOString(),
  factKey: 'custom_stressLevel',
  factLabel: 'Stress Level',
  value: 'Moderate',
  category: 'Emotions'
});
```

❌ **Bad** (overwriting, loses history):
```typescript
await updateDoc(bossRef, {
  custom_stressLevel: 'Moderate'  // Lost previous values
});
```

---

## FAQ

### Can users add their own custom fields?
Yes! Users can add any field they want with the `custom_` prefix and metadata.

### What happens if I delete a custom field?
The field and its metadata are removed from the document. The operation is permanent.

### Can I rename a field?
No direct rename. You need to create a new field and migrate the value, then delete the old field.

### How do I handle multi-select fields?
Store as JSON string in the field value:
```typescript
custom_givingFeedback: JSON.stringify(["Work processes", "Deadlines"])
```

Or store as array if Firestore supports it:
```typescript
custom_givingFeedback: ["Work processes", "Deadlines"]
```

### What if _fieldsMeta is missing?
The migration script will add it. You can also manually add it when you first encounter the field.

### Can I have nested objects in custom fields?
Not recommended. Keep custom fields flat (single values, arrays, or JSON strings).

---

## Related Documentation

- [Firestore Management Guide](./firestore-management.md) - General Firestore practices
- [Field Presets Reference](../firestore/schemas/field-presets.ts) - All available field configurations
- [Schema Definitions](../firestore/schemas/) - TypeScript type definitions
