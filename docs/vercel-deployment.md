# Vercel Web Deployment

Automatic web deployment to Vercel from the `main` branch.

## What's Configured

- ✅ Build script `build:web` in `package.json`
- ✅ Vercel configuration in `vercel.json`
- ✅ SPA routing (all routes redirect to `index.html`)

## Initial Vercel Setup

### 1. Connect Repository to Vercel

#### Option A: Via Vercel CLI (Recommended)

```bash
# Install Vercel CLI globally (if not installed)
npm install -g vercel

# Login to Vercel
vercel login

# Link the project to Vercel
vercel link

# Deploy
vercel --prod
```

#### Option B: Via Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Select this repository (`boss-app`)
4. Vercel will automatically detect settings from `vercel.json`

### 2. Verify Project Settings

Vercel should automatically detect:

```
Framework Preset: Other
Build Command: npm run build:web
Output Directory: dist
Install Command: npm install
```

If something is wrong, these settings can be changed in **Project Settings → Build & Development Settings**.

### 3. Configure Environment Variables (Optional)

If you have environment variables (e.g., Firebase config), add them in:

**Project Settings → Environment Variables**

Example Firebase variables:
```
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**Important:** Use the `EXPO_PUBLIC_` prefix for variables that should be accessible in client code.

### 4. Deploy

Click **"Deploy"** — Vercel will:
- Install dependencies
- Build web version via `expo export --platform web`
- Publish the result

## Automatic Deployment

After initial setup:

- ✅ **Push to `main`** → automatic production deployment
- ✅ **Pull Request** → automatic preview deployment with unique URL
- ✅ **Each commit** → new version with preview URL

## Deployment Verification

After successful deployment, you'll get:

1. **Production URL**: `https://your-project.vercel.app`
2. **Preview URLs** for each PR: `https://your-project-git-branch.vercel.app`

## Local Build Testing

Test the build locally before deployment:

```bash
# Build web version
npm run build:web

# Result will be in dist/ folder
# You can run a local server to test:
npx serve dist
```

## Useful Commands

```bash
# Run dev web version
npm run web

# Build production web version
npm run build:web

# Check Vercel login status
vercel whoami

# Deploy to production
vercel --prod
```

## Troubleshooting

### Build Error

If Vercel cannot build the project:

1. Check that all dependencies are installed correctly
2. Try building locally: `npm run build:web`
3. Check build logs in Vercel Dashboard

### Routing Issues

If pages don't open when navigating directly via URL:

- Make sure `vercel.json` has the `rewrites` rule (already configured)

### Environment Variables Not Working

- Make sure you use the `EXPO_PUBLIC_` prefix for client variables
- Check that variables are added in Vercel Project Settings
- Redeploy after changing environment variables

## Additional Information

- [Vercel Documentation](https://vercel.com/docs)
- [Expo Web Documentation](https://docs.expo.dev/workflow/web/)
- [Environment Variables in Expo](https://docs.expo.dev/guides/environment-variables/)

