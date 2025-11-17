# What to Test

Critical features to test before releasing BossUp.

## Authentication
- Magic link sign in
- Apple Sign-In
- Google Sign-In
- Sign out and back in

## Boss Management
- Create, edit, delete boss
- Switch between bosses
- Data persists after restart

## Timeline & Entries
- Add note/fact entries
- Edit and delete entries
- Timeline sorts by date
- Entries sync across devices

## AI Chat
- Send message and receive response
- Typing indicator works
- Unread badge on chat button
- App icon badge syncs

## Subscriptions
- View plans
- Purchase (iOS sandbox)
- Restore purchases
- Premium features unlock

## Notifications
- Permission onboarding
- Push notifications deliver
- Tapping opens app

## Tracking (iOS)
- ATT permission onboarding
- Re-prompt after 2 weeks if denied

## Data Sync
- Changes sync to Firestore
- Works offline with cached data
- Syncs when back online

## Cross-Platform
- iOS, Android, Web all work
- Data syncs between platforms

## Security
- Users see only their own data
- Firestore rules block unauthorized access

