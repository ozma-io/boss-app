# BossUp Documentation

Complete documentation for BossUp project.

---

## 📖 Main Documentation

### [Firebase Deployment Guide](./firebase-deployment.md)
Complete guide for deploying all Firebase resources:
- Cloud Functions deployment
- Firestore rules and indexes
- Multi-environment setup
- Service account permissions
- Troubleshooting

### [Firestore Management](./firestore-management.md)
Managing Firestore database:
- Data schemas and TypeScript types
- Security rules
- Database indexes
- Data migrations
- Best practices

### [Authentication System](./authentication.md)
Complete authentication documentation:
- Email magic link (passwordless) authentication flow
- Custom domain setup (boss-app.ozma.io)
- Universal Links (iOS) and App Links (Android)
- Apple Sign-In integration
- Google Sign-In integration
- Development vs production environments
- Auth state management and security

### [Facebook Attribution & Conversions API](./facebook-integration.md)
Facebook integration for attribution tracking and analytics:
- Getting Facebook credentials (App ID, Pixel ID, Access Token)
- Universal Links / App Links setup
- Attribution data tracking
- Conversions API usage examples
- Testing and troubleshooting

### [Tracking & Attribution Flow](./tracking-and-attribution-flow.md)
Complete flow documentation for tracking permissions and attribution:
- iOS App Tracking Transparency (ATT) flow
- Android attribution flow
- First launch scenarios with/without Facebook attribution
- Re-prompt logic after 2 weeks
- Technical implementation details
- Testing and troubleshooting

### [Amplitude Events Naming Convention](./amplitude-naming-convention.md)
Simple naming rules for custom Amplitude events:
- Event naming format and structure
- Best practices and examples
- Event categories and properties usage
- When and what to track

### AI Chat Integration
AI-powered chat feature with OpenAI GPT-5:
- **Frontend:** `app/chat.tsx` - chat screen with typing indicator
- **Service:** `services/chat.service.ts` - message management, AI response triggering
- **Backend:** `functions/src/chat.ts` - Cloud Function with OpenAI API integration
- **Schema:** `firestore/schemas/chat.schema.ts` - OpenAI-compatible multimodal format
- **Types:** `types/index.ts` + `functions/src/types/chat.types.ts`
- **Config:** Message history window (24h), model selection in `functions/src/constants.ts`
- **Unread Counter:** Firestore Trigger auto-increments `unreadCount` on AI messages, `FloatingChatButton` shows iOS-style badge, app icon badge syncs, `markChatAsRead()` resets on screen open

### [Subscriptions & In-App Purchases](./subscriptions-iap.md)
Apple and Google in-app purchase integration:
- **Frontend:** `app/subscription.tsx` - subscription screen with plan selection
- **Service:** `services/iap.service.ts` - IAP SDK integration, purchase flow
- **Backend:** `functions/src/iap-verification.ts` - receipt verification with Apple/Google
- **Platform Support:** iOS (active), Android (coming soon), Web uses Stripe
- **Auto-Migration:** Stripe → IAP migration handled automatically in Cloud Functions
- **Setup:** App Store Connect, Firebase secrets, testing with sandbox accounts

### [Magic Link Development](./magic-link-development.md)
Development workflow for magic link authentication:
- Testing magic links in iOS Simulator
- Manual link paste workflow
- Production setup with Universal Links

### [Vercel Web Deployment](./vercel-deployment.md)
Automatic web deployment on Vercel:
- Auto-deploy from `main` branch
- Preview URLs for pull requests
- Environment variables setup
- Troubleshooting

---

## 🚀 Quick Start

**New to the project?** Start here:

1. [Setup Instructions](../SETUP.md) - Initial project setup
2. [Firebase Deployment Guide](./firebase-deployment.md) - Deploy backend
3. [Main README](../README.md) - Quick reference

---

## 📁 Additional Documentation

- **[scripts/README.md](../scripts/README.md)** - Automation scripts
- **[firestore/schemas/README.md](../firestore/schemas/README.md)** - TypeScript schemas
- **[firestore/migrations/README.md](../firestore/migrations/README.md)** - Data migrations

---

## 👤 User Flows

End-to-end user experience flows:

- **[Facebook Attribution User Flow](./user-flows/facebook-attribution-user-flow.md)** - Complete flow for users installing from Facebook ads (iOS/Android differences, tracking permissions, attribution data lifecycle)

---

## 🎯 Documentation Structure

```
docs/
├── README.md                       # This file - documentation index
├── firebase-deployment.md          # Firebase deployment guide
├── firestore-management.md         # Firestore database management
├── authentication.md               # Authentication system (magic links, Apple, Google)
├── subscriptions-iap.md            # Subscriptions & In-App Purchases (IAP)
├── facebook-integration.md         # Facebook Attribution & Conversions API
├── tracking-and-attribution-flow.md # Tracking & Attribution flow scenarios
├── amplitude-integration.md        # Amplitude Analytics integration guide
├── amplitude-naming-convention.md  # Amplitude events naming convention
├── magic-link-development.md       # Magic link development workflow
├── vercel-deployment.md            # Vercel web deployment
├── expo-cloud-setup.md             # Expo cloud build setup (iOS/Android)
└── user-flows/                     # User journey documentation
    └── facebook-attribution-user-flow.md

Key files for AI Chat:
├── app/chat.tsx                    # Chat UI
├── services/chat.service.ts        # Chat service
├── functions/src/chat.ts           # OpenAI Cloud Function
└── firestore/schemas/chat.schema.ts # Chat data schema

Key files for IAP:
├── app/subscription.tsx            # Subscription UI
├── services/iap.service.ts         # IAP service
└── functions/src/iap-verification.ts # Receipt verification
```

---

## 🔗 External Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [React Native Documentation](https://reactnative.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

