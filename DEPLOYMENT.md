# Deployment Guide - BBQ Franchise Management Platform

## Vercel Deployment

### Prerequisites
1. Vercel account
2. Turso database credentials (provided)

### Step 1: Import Project to Vercel

1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Import your GitHub repository: `yonghuni912-create/New`
4. Select the branch: `copilot/implement-bbq-platform`

### Step 2: Configure Environment Variables

Add the following environment variables in Vercel dashboard:

```
TURSO_DATABASE_URL=libsql://bbqtest-kunikun.aws-us-west-2.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgyNTQ5NDIsImlkIjoiYjg0NDM1NGUtZjE4YS00NWMzLWI1ZDctNDk2NjljOTM3ZDY3IiwicmlkIjoiZWYzYzk2MGItMDk4Mi00ODhiLWJiNjEtMzc2YzJhNzgwYTliIn0.KSdizD28gjbcZiAjX7KOywhPusSQcPcLDd89ovltYNQX9y2tKakH83Dwxv-iR9JnP5mqOWFGZIT5afP3n6obBA
NEXTAUTH_SECRET=<generate-with: openssl rand -base64 32>
NEXTAUTH_URL=<your-vercel-app-url>
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### Step 3: Deploy

1. Click "Deploy"
2. Wait for the build to complete
3. Once deployed, get your Vercel URL
4. Update `NEXTAUTH_URL` environment variable with your actual Vercel URL
5. Redeploy the application

### Step 4: Initialize Database

After first deployment, you need to push the schema to Turso:

```bash
# Install Turso CLI locally
curl -sSfL https://get.tur.so/install.sh | bash

# Login to Turso
turso auth login

# Push Prisma schema to Turso
npm run db:push

# Seed the database
npm run db:seed
```

Alternatively, you can run these commands in your local environment connected to Turso:

```bash
# Set environment variables
export TURSO_DATABASE_URL="libsql://bbqtest-kunikun.aws-us-west-2.turso.io"
export TURSO_AUTH_TOKEN="<your-token>"

# Push schema
npx prisma db push

# Seed database
npm run db:seed
```

### Step 5: Verify Deployment

1. Visit your Vercel URL
2. You should see the login page
3. Test login with demo accounts:
   - Admin: admin@bbq.com / admin123
   - PM: pm@bbq.com / pm123
   - User: user@bbq.com / user123

## Manual Deployment via CLI

If you prefer deploying via CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Set environment variables
vercel env add TURSO_DATABASE_URL production
vercel env add TURSO_AUTH_TOKEN production
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production
```

## Post-Deployment

### Database Seeding

If the database is empty after deployment:

1. Clone the repository locally
2. Set environment variables in `.env`:
   ```
   TURSO_DATABASE_URL=libsql://bbqtest-kunikun.aws-us-west-2.turso.io
   TURSO_AUTH_TOKEN=<your-token>
   ```
3. Run:
   ```bash
   npm install
   npx prisma generate
   npx prisma db push
   npm run db:seed
   ```

### Monitoring

- Check Vercel logs for any errors
- Monitor database usage in Turso dashboard
- Test all features after deployment

## Troubleshooting

### Build Fails
- Check Vercel build logs
- Ensure all environment variables are set
- Verify Prisma can connect to Turso

### Database Connection Issues
- Verify TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are correct
- Check Turso database is active
- Ensure database schema is pushed

### Authentication Issues
- Verify NEXTAUTH_SECRET is set
- Check NEXTAUTH_URL matches your deployment URL
- Ensure all domain are added to NextAuth allowed list

## Features Included

✅ Remember Email - Saves user email in localStorage
✅ Auto Login - Keeps users signed in
✅ Excel Template Generation - Menu manuals with BBQ Canada formatting
✅ Turso Database - Production-ready cloud database
✅ Complete RBAC - Role-based access control
✅ File Management - Upload and download documents
✅ Task Management - With cascade scheduling
✅ Dashboard - KPIs and analytics
✅ Multi-country Support - Global franchise management

## Next Steps

1. Customize the application for your needs
2. Add more menu items and ingredients
3. Configure email notifications
4. Set up custom domain
5. Enable analytics
