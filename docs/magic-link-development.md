# Magic Link Authentication in Development

## Problem

When developing with iOS Simulator, Firebase sends magic links with HTTP URLs:
```
http://192.168.1.74:8081/?email=...&apiKey=...&oobCode=...
```

This URL opens in the computer's browser instead of the iOS Simulator, preventing authentication from working.

## Solution: Manual Link Paste (Recommended)

The easiest way to test magic links in iOS Simulator:

1. Send magic link through the app
2. Open email on your computer and **copy the full URL**
3. In the app on "Check your email" screen, tap **"Paste link manually"**
4. Paste the copied URL
5. Tap **"Verify Link"**

✨ Done! You're authenticated.

### Alternative: Terminal Command

Open the magic link directly in simulator:

```bash
xcrun simctl openurl booted "http://192.168.1.74:8081/?email=...&apiKey=...&oobCode=..."
```

⚠️ This opens Safari in simulator, but Safari may not handle HTTP deep links properly.

## How It Works

### Development Build
- Firebase requires HTTP/HTTPS URLs for magic links (not custom schemes)
- App uses `http://192.168.1.74:8081` in development
- This URL opens in browser, not in the app
- Manual paste mode added to work around this limitation

### Production Build
In production, configure one of these options:

**Option A: Universal Links** (recommended)
- Set up a real domain (e.g., `https://bossapp.com`)
- Add Associated Domains in Xcode
- iOS automatically opens the app when magic link is clicked

**Option B: Custom URL Scheme**
- Use `bossapp://` scheme
- Configure in Firebase Console → Authentication → Settings → Authorized domains
- Less reliable than Universal Links

## Code Implementation

Debug mode is available only on non-web platforms:

```typescript
{Platform.OS !== 'web' && (
  <TouchableOpacity onPress={() => setShowDebugInput(!showDebugInput)}>
    <Text>Paste link manually</Text>
  </TouchableOpacity>
)}
```

For production, either remove this or restrict to dev mode:

```typescript
{(__DEV__ && Platform.OS !== 'web') && (
  // debug UI
)}
```

## Best Practices

### Development
✅ Use "Paste link manually" for quick testing  
✅ This is normal for MVP and local development  
✅ HTTP URLs work but require manual copying

### Production
✅ Set up Universal Links with a real domain  
✅ Test on physical devices, not just simulator  
✅ Consider Firebase Dynamic Links for cross-platform support

## FAQ

**Q: Why not use `bossapp://` immediately?**  
A: Firebase Auth requires HTTP/HTTPS URLs for magic links. Custom schemes don't work with Firebase email link authentication.

**Q: Why does this require manual handling?**  
A: Development Builds use standard HTTP URLs that open in the browser by default. Universal Links (production) or manual paste (development) are needed to open links in the app.

**Q: Can this be automated?**  
A: Yes, by using:
- Universal Links with a real domain
- Firebase Dynamic Links
- ngrok or similar tunneling for HTTPS in development
- Or keep the debug mode for local development (current approach)

