# Railway Deployment Instructions

This app has been configured for Railway deployment with mock authentication.

## Required Environment Variables

Set these in your Railway dashboard:

### Essential Variables
```
DATABASE_URL=postgresql://user:password@hostname:5432/database
OPENAI_API_KEY=your-openai-api-key
YOUTUBE_API_KEY=your-youtube-data-api-key
SESSION_SECRET=your-random-session-secret-key
NODE_ENV=production
```

### Optional Variables
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY=your-service-account-private-key
GOOGLE_API_KEY=your-google-api-key (alternative to YOUTUBE_API_KEY)
```

## Deployment Methods

### Method 1: Web Dashboard (Recommended)
1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub account and select your repository
4. Railway will auto-detect the Node.js project
5. Add environment variables in the "Variables" tab
6. Deploy will start automatically

### Method 2: Railway CLI
1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Link to existing project OR create new one**
   ```bash
   # Link existing project (if you already created one via web)
   railway link [PROJECT_ID]
   
   # OR create new project
   railway init
   ```

4. **Set Environment Variables**
   ```bash
   railway variables set DATABASE_URL="your-neon-database-url"
   railway variables set OPENAI_API_KEY="your-openai-key"
   railway variables set YOUTUBE_API_KEY="your-youtube-key"
   railway variables set SESSION_SECRET="$(openssl rand -base64 32)"
   railway variables set NODE_ENV="production"
   ```

5. **Deploy**
   ```bash
   railway up
   ```

## Recent Fixes Applied

- ✅ **Node Version**: Added engines specification for Node 18+
- ✅ **Compatibility**: Fixed `import.meta.dirname` compatibility issue
- ✅ **Build Config**: Added `nixpacks.toml` for proper Railway builds
- ✅ **Dependencies**: Verified all packages work on Railway

## Current Configuration

- ✅ Mock authentication system (everyone uses test user "railway-test-user")
- ✅ All API routes work without real authentication
- ✅ Database operations function normally
- ✅ Video analysis, quiz generation, and analytics work
- ✅ Express server configured for Railway's port system
- ✅ Build tested and working locally

## Troubleshooting

### If build still fails:
1. **Check logs**: In Railway dashboard → Your service → "Deployments" tab → Click failed deployment
2. **Environment variables**: Ensure all required vars are set
3. **Database**: Verify `DATABASE_URL` is correct and database is accessible
4. **API Keys**: Make sure your OpenAI and YouTube API keys are valid

### Common Issues:
- **"Module not found"**: Run `npm install` locally first
- **"Build timeout"**: Railway has build timeouts, try deploying via GitHub repo
- **"Port binding error"**: Railway automatically sets PORT, don't override it

## API Keys Setup

### YouTube Data API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable YouTube Data API v3
4. Create credentials (API Key)
5. Use this as `YOUTUBE_API_KEY`

### OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create account and add billing
3. Generate API key in API section
4. Use this as `OPENAI_API_KEY`

### Neon Database
1. Keep your existing `DATABASE_URL` from Replit
2. Or create new database at [neon.tech](https://neon.tech)

## Post-Deployment Testing

Once deployed, test these endpoints:
- `GET /api/auth/user` - Should return test user
- `POST /api/videos/analyze` - Test video analysis
- `GET /api/videos` - List user videos
- `POST /api/quiz/start` - Start a quiz

## Adding Real Authentication Later

When ready to add real authentication, you can:
1. Replace `mockAuth` middleware with real auth system
2. Update client-side `useAuth` hook
3. Add login/logout UI components

The rest of the app will work unchanged. 