# 📦 Tech Stack for the MVP Mobile App "Boss Relationship Tracker"

## 🧱 Technology Stack

### Client (Mobile App)
- **React Native** — cross-platform development (iOS + Android)
- **Expo** — fast setup, simplified build and deployment
- **TypeScript** — required; improves type safety and developer experience
- **Expo Router** — file-based routing and navigation (like Next.js)
- **Expo Notifications** — receiving push notifications on the device

### Backend / BaaS
- **Firebase** — complete backend platform:
  - **Firestore** — NoSQL cloud database
  - **Firebase Authentication** — login with email, social providers, Apple ID
  - **Firebase Cloud Messaging (FCM)** — push notification service
  - **Firebase Cloud Functions** — serverless backend logic (scheduling, triggers, etc.)
  - **Firebase Security Rules** — per-user access control

### Deployment
- **Expo EAS Build** — cloud builds for iOS and Android
- **Expo EAS Submit** — submission to App Store and Google Play
- **Expo EAS Update** — over-the-air (OTA) updates for JS/TS code and assets (no store resubmission needed)
- **Firebase Console / Hosting** — backend and data configuration

*Note: Using direct production rollouts (100% immediately). Gradual rollouts postponed until product validation.*

---

# 🗃️ Firebase Firestore Data Structure

## Collection: Users
Path: `/users/{userId}`

User document example:
*JSON:*
{
  "email": "user@example.com",
  "currentBossId": "abc123",
  "createdAt": "2025-10-19T10:00:00Z"
}

---

## Subcollection: Bosses
Path: `/users/{userId}/bosses/{bossId}`

Boss document example:
*JSON:*
{
  "name": "Olga Ivanovna",
  "position": "CTO",
  "startedAt": "2025-09-01T00:00:00Z"
}

---

## Subcollection: Entries (Flexible History)
Path: `/users/{userId}/bosses/{bossId}/entries/{entryId}`

Each entry represents a note, interaction, survey, etc., distinguished by `type`.

### Example entry: Note
*JSON:*
{
  "type": "note",
  "timestamp": "2025-10-19T11:00:00Z",
  "content": "Boss seemed tense before the meeting."
}

### Example entry: Survey
*JSON:*
{
  "type": "survey",
  "timestamp": "2025-10-17T08:00:00Z",
  "survey": {
    "trustLevel": 4,
    "support": 5
  }
}

### Example entry: Interaction
*JSON:*
{
  "type": "interaction",
  "timestamp": "2025-10-16T15:30:00Z",
  "mood": "neutral",
  "notes": "Discussed quarterly goals."
}

---

🔐 **Security**: Firestore Security Rules ensure that `request.auth.uid === userId`. This guarantees that users can only access their own documents.
