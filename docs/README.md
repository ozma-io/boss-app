# Boss App Documentation

Complete documentation for The Boss App project.

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
- Email link (passwordless) authentication
- Apple Sign-In integration
- Google Sign-In integration
- Auth state management
- Security and data scoping

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
├── authentication.md               # Authentication system
├── facebook-integration.md         # Facebook Attribution & Conversions API
├── tracking-and-attribution-flow.md # Tracking & Attribution flow scenarios
├── magic-link-development.md       # Magic link development workflow
├── vercel-deployment.md            # Vercel web deployment
├── expo-cloud-setup.md             # Expo cloud build setup (iOS/Android)
└── user-flows/                     # User journey documentation
    └── facebook-attribution-user-flow.md
```

---

## 🔗 External Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [React Native Documentation](https://reactnative.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

