# Vercel Deployment Guide for BBQ Franchise Platform

## Project Information
- **Project Name**: fire-repo
- **Vercel Project ID**: prj_8T4knK8D0HWTVAWjg61N2hw5SHn4
- **Deployment URL**: https://vercel.com/yonghun-lees-projects/fire-repo
- **Repository**: yonghuni912-create/New
- **Branch**: copilot/fix-merge-conflict-markers

## Prerequisites
✅ Build succeeds locally (`npm run build`)
✅ Environment variables configured
✅ No merge conflict markers in source code

## Environment Variables for Vercel

Configure the following environment variables in your Vercel project settings:

### Required Environment Variables:

```plaintext
TURSO_DATABASE_URL=libsql://bbqtest-kunikun.aws-us-west-2.turso.io

TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgyNTQ5NDIsImlkIjoiYjg0NDM1NGUtZjE4YS00NWMzLWI1ZDctNDk2NjljOTM3ZDY3IiwicmlkIjoiZWYzYzk2MGItMDk4Mi00ODhiLWJiNjEtMzc2YzJhNzgwYTliIn0.KSdizD28gjbcZiAjX7KOywhPusSQcPcLDd89ovltYNQX9y2tKakH83Dwxv-iR9JnP5mqOWFGZIT5afP3n6obBA

NEXTAUTH_SECRET=secret0707

NEXTAUTH_URL=https://fire-repo-yonghun-lees-projects.vercel.app
```

**Note**: Update `NEXTAUTH_URL` after your first deployment to match your actual Vercel URL.

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/yonghun-lees-projects/fire-repo
   - Or navigate to: https://vercel.com and select your project `fire-repo`

2. **Configure Environment Variables**
   - Click on "Settings" tab
   - Navigate to "Environment Variables" section
   - Add each variable listed above:
     - Click "Add"
     - Enter variable name (e.g., `TURSO_DATABASE_URL`)
     - Enter variable value
     - Select environment: Production, Preview, and Development (or as needed)
     - Click "Save"
   - Repeat for all four variables

3. **Deploy from GitHub**
   - Go to "Deployments" tab
   - Click "Redeploy" on the latest deployment
   - OR push a new commit to trigger automatic deployment
   - Wait for build to complete

4. **Update NEXTAUTH_URL**
   - Once deployed, copy your deployment URL
   - Go back to Settings → Environment Variables
   - Update `NEXTAUTH_URL` with your actual URL
   - Example: `https://fire-repo-yonghun-lees-projects.vercel.app`
   - Redeploy to apply changes

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Link to existing project
vercel link --project-id prj_8T4knK8D0HWTVAWjg61N2hw5SHn4

# Add environment variables
vercel env add TURSO_DATABASE_URL production
# Paste: libsql://bbqtest-kunikun.aws-us-west-2.turso.io

vercel env add TURSO_AUTH_TOKEN production
# Paste the full token value

vercel env add NEXTAUTH_SECRET production
# Enter: secret0707

vercel env add NEXTAUTH_URL production
# Enter your Vercel URL (will update after first deployment)

# Deploy to production
vercel --prod

# After deployment, update NEXTAUTH_URL with actual URL
vercel env rm NEXTAUTH_URL production
vercel env add NEXTAUTH_URL production
# Enter: https://your-actual-vercel-url.vercel.app

# Redeploy
vercel --prod
```

### Option 3: Automatic Deployment via GitHub

1. **Push to Branch**
   - Ensure environment variables are configured in Vercel dashboard
   - Push commits to `copilot/fix-merge-conflict-markers` branch
   - Vercel will automatically deploy

2. **Check Deployment Status**
   - Visit: https://vercel.com/yonghun-lees-projects/fire-repo
   - Monitor build logs for any errors

## Post-Deployment Steps

### 1. Verify Deployment
- Visit your deployment URL
- You should see the BBQ Franchise Platform login page
- Check browser console for any errors

### 2. Initialize Database (if needed)

The database schema should already be set up in Turso. If you need to push the schema or seed data:

```bash
# Set environment variables locally
export TURSO_DATABASE_URL="libsql://bbqtest-kunikun.aws-us-west-2.turso.io"
export TURSO_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgyNTQ5NDIsImlkIjoiYjg0NDM1NGUtZjE4YS00NWMzLWI1ZDctNDk2NjljOTM3ZDY3IiwicmlkIjoiZWYzYzk2MGItMDk4Mi00ODhiLWJiNjEtMzc2YzJhNzgwYTliIn0.KSdizD28gjbcZiAjX7KOywhPusSQcPcLDd89ovltYNQX9y2tKakH83Dwxv-iR9JnP5mqOWFGZIT5afP3n6obBA"

# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed the database
npm run db:seed
```

### 3. Test the Application

Test with demo accounts (if seeded):
- **Admin**: admin@bbq.com / admin123
- **PM**: pm@bbq.com / pm123
- **User**: user@bbq.com / user123

## Expected Deployment URL

Based on the project configuration, your application will be available at:
- **Primary URL**: https://fire-repo-yonghun-lees-projects.vercel.app
- **Alternative**: https://fire-repo.vercel.app (if available)

## Troubleshooting

### Build Failures
- Check Vercel build logs for specific error messages
- Ensure all environment variables are correctly set
- Verify DATABASE_URL format is correct for Turso

### Database Connection Errors
- Verify `TURSO_DATABASE_URL` starts with `libsql://`
- Check `TURSO_AUTH_TOKEN` is complete and correct
- Ensure Turso database is active and accessible

### Authentication Issues
- Verify `NEXTAUTH_SECRET` is set
- Ensure `NEXTAUTH_URL` matches your deployment URL exactly
- Clear cookies and try logging in again

### Environment Variable Issues
- Variables set in Vercel override `.env.production`
- Redeploy after changing environment variables
- Check variable scope (Production/Preview/Development)

## Verification Checklist

After deployment, verify:
- [ ] Application loads without errors
- [ ] Login page is displayed
- [ ] Can authenticate with test credentials
- [ ] Dashboard loads correctly
- [ ] Database queries work (no connection errors)
- [ ] All routes are accessible

## Next Steps

1. Monitor application logs in Vercel dashboard
2. Set up custom domain (optional)
3. Configure additional security settings
4. Set up monitoring and analytics
5. Test all features thoroughly

## Support Resources

- Vercel Documentation: https://vercel.com/docs
- Turso Documentation: https://docs.turso.tech
- NextAuth Documentation: https://next-auth.js.org
- Project Repository: https://github.com/yonghuni912-create/New

---

**Deployment Status**: Ready for deployment
**Last Updated**: 2026-01-14
