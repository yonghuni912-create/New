# Vercel Deployment Instructions for BBQ Platform

## Project Information
- **Vercel Project ID**: `prj_8T4knK8D0HWTVAWjg61N2hw5SHn4`
- **Project Name**: `fire-repo`
- **Project URL**: https://vercel.com/yonghun-lees-projects/fire-repo
- **Live URL**: https://fire-repo.vercel.app

## Prerequisites
✅ Build verified successful (`npm run build` passes)
✅ No merge conflicts found in codebase
✅ Environment variables configured

## Environment Variables for Vercel

⚠️ **Security Notice**: The credentials below are for initial deployment only. For production use, rotate these secrets and use secure, randomly generated values.

Configure the following environment variables in your Vercel project dashboard:

```
TURSO_DATABASE_URL=libsql://bbqtest-kunikun.aws-us-west-2.turso.io
TURSO_AUTH_TOKEN=<REDACTED_FOR_SECURITY>
NEXTAUTH_SECRET=secret0707
NEXTAUTH_URL=https://fire-repo.vercel.app
```

**Note**: Use the actual `TURSO_AUTH_TOKEN` value provided separately. Do not commit production secrets to version control.

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard

1. Go to https://vercel.com/yonghun-lees-projects/fire-repo
2. Navigate to Settings → Environment Variables
3. Add all the environment variables listed above for **Production** environment
4. Go to Deployments tab
5. Click "Redeploy" on the latest deployment or trigger a new deployment
6. Wait for the build to complete

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Link to existing project
vercel link --project-id prj_8T4knK8D0HWTVAWjg61N2hw5SHn4

# Set environment variables (one-time setup)
# Replace <YOUR_TOKEN> with the actual token value
vercel env add TURSO_DATABASE_URL production
# When prompted, enter: libsql://bbqtest-kunikun.aws-us-west-2.turso.io

vercel env add TURSO_AUTH_TOKEN production
# When prompted, enter the token value provided separately

vercel env add NEXTAUTH_SECRET production
# When prompted, enter: secret0707

vercel env add NEXTAUTH_URL production
# When prompted, enter: https://fire-repo.vercel.app

# Deploy to production
vercel --prod
```

## Post-Deployment Verification

After deployment, verify:

1. ✅ Application is accessible at https://fire-repo.vercel.app
2. ✅ Login page loads correctly
3. ✅ Database connection works (try logging in)
4. ✅ All routes are functioning

### Test Credentials
- **Admin**: admin@bbq.com / admin123
- **PM**: pm@bbq.com / pm123
- **User**: user@bbq.com / user123

## Database Initialization

⚠️ **Security**: Use secure connection and never commit database credentials to source control.

If the database needs to be seeded:

```bash
# Local setup with Turso connection
# Set these in a secure way - DO NOT commit to git
export TURSO_DATABASE_URL="libsql://bbqtest-kunikun.aws-us-west-2.turso.io"
export TURSO_AUTH_TOKEN="<YOUR_TOKEN_HERE>"

# Push schema and seed
npm install
npx prisma generate
npx prisma db push
npm run db:seed
```

## Build Configuration

The project is configured with:
- **Framework**: Next.js 14.2.35
- **Build Command**: `prisma generate && next build`
- **Output Directory**: `.next`
- **Node Version**: Automatic (from package.json engines or latest LTS)

## Troubleshooting

### Build Fails
- Verify all environment variables are set correctly
- Check Vercel build logs for specific errors
- Ensure `prisma generate` runs successfully

### Database Connection Issues
- Verify TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are correct
- Check if Turso database is active and accessible
- Ensure schema has been pushed to the database

### Authentication Issues
- Verify NEXTAUTH_SECRET matches the configured value
- Check NEXTAUTH_URL matches your deployment URL
- Clear browser cookies and try again

## Notes

- The build may show database connection warnings during the build process - this is expected and won't prevent deployment
- ESLint warnings about deprecated options can be ignored - they don't affect the build
- The application uses Next.js App Router with dynamic and static routes
