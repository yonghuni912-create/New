# Troubleshooting Guide - BBQ Franchise Platform

## 500 Internal Server Error on Vercel

If you're getting a 500 error after deployment, follow these steps:

### Step 1: Check Vercel Runtime Logs

1. Go to your Vercel Dashboard: https://vercel.com/yonghun-lees-projects/fire-repo
2. Click on your latest deployment
3. Click on the "Logs" or "Runtime Logs" tab
4. Look for error messages - they will show exactly what's failing

### Step 2: Verify Environment Variables

Go to **Settings → Environment Variables** and verify these are set correctly:

#### Required Variables:

```plaintext
TURSO_DATABASE_URL=libsql://bbqtest-kunikun.aws-us-west-2.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgyNTQ5NDIsImlkIjoiYjg0NDM1NGUtZjE4YS00NWMzLWI1ZDctNDk2NjljOTM3ZDY3IiwicmlkIjoiZWYzYzk2MGItMDk4Mi00ODhiLWJiNjEtMzc2YzJhNzgwYTliIn0.KSdizD28gjbcZiAjX7KOywhPusSQcPcLDd89ovltYNQX9y2tKakH83Dwxv-iR9JnP5mqOWFGZIT5afP3n6obBA
NEXTAUTH_SECRET=secret0707
NEXTAUTH_URL=<your-actual-vercel-url>
```

⚠️ **CRITICAL**: `NEXTAUTH_URL` must match your actual deployment URL exactly!

**How to find your deployment URL:**
1. In Vercel Dashboard, go to your deployment
2. Look for the URL at the top (e.g., `https://fire-repo-abc123.vercel.app`)
3. Copy this URL
4. Set `NEXTAUTH_URL` to this exact URL (including `https://`)

**Common mistakes:**
- ❌ Using `https://fire-repo-yonghun-lees-projects.vercel.app` (guessed URL)
- ✅ Using your actual deployment URL from Vercel

### Step 3: Initialize Database (Most Common Issue)

The 500 error is often caused by an **empty or uninitialized database**.

#### Option A: Initialize Database Locally

```bash
# Clone the repository locally
git clone https://github.com/yonghuni912-create/New.git
cd New

# Install dependencies
npm install

# Create .env file with Turso credentials
cat > .env << EOF
TURSO_DATABASE_URL=libsql://bbqtest-kunikun.aws-us-west-2.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgyNTQ5NDIsImlkIjoiYjg0NDM1NGUtZjE4YS00NWMzLWI1ZDctNDk2NjljOTM3ZDY3IiwicmlkIjoiZWYzYzk2MGItMDk4Mi00ODhiLWJiNjEtMzc2YzJhNzgwYTliIn0.KSdizD28gjbcZiAjX7KOywhPusSQcPcLDd89ovltYNQX9y2tKakH83Dwxv-iR9JnP5mqOWFGZIT5afP3n6obBA
EOF

# Generate Prisma Client
npx prisma generate

# Push database schema to Turso
npx prisma db push

# Seed the database with initial data
npm run db:seed
```

#### Option B: Check if Database is Already Initialized

Run this to check if your database has tables:

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Login to Turso
turso auth login

# List your databases
turso db list

# Connect to your database
turso db shell bbqtest

# Check if tables exist
.tables

# If tables exist, check if there's data
SELECT COUNT(*) FROM User;
```

### Step 4: Common Error Messages and Solutions

#### "No native build was found for platform=linux" (bcrypt error)
**Cause**: Native module (bcrypt) not compatible with Vercel serverless
**Solution**: ✅ **FIXED in latest commit** - The code has been updated to use `bcryptjs` instead
- If you still see this, redeploy to get the latest code
- The error message will mention `bcrypt` or `node-gyp-build`

#### "PrismaClientInitializationError"
**Cause**: Database connection failed
**Solution**: 
- Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are correct
- Check if Turso database is active and accessible

#### "Table 'User' does not exist"
**Cause**: Database schema not pushed
**Solution**: Run `npx prisma db push` as shown in Step 3

#### "Invalid credentials" or "User not found"
**Cause**: Database is empty (no users)
**Solution**: Run `npm run db:seed` to add default users

#### "NEXTAUTH_SECRET must be provided"
**Cause**: Environment variable not set
**Solution**: Add `NEXTAUTH_SECRET=secret0707` in Vercel

#### "Callback URL mismatch"
**Cause**: `NEXTAUTH_URL` doesn't match deployment URL
**Solution**: Update `NEXTAUTH_URL` to match your actual Vercel URL

### Step 5: After Fixing - Redeploy

After making any environment variable changes:
1. Go to Vercel Dashboard → Deployments
2. Click the three dots (⋮) on your latest deployment
3. Click "Redeploy"
4. Wait for deployment to complete
5. Test the application

### Step 6: Test the Application

Once deployed successfully:
1. Visit your Vercel URL
2. You should see the login page
3. Try logging in with default credentials:
   - Email: `admin@bbq.com`
   - Password: `admin123`

### Still Having Issues?

If the error persists:

1. **Share the Runtime Logs**: Copy the error from Vercel Runtime Logs
2. **Verify all environment variables**: Screenshot your Environment Variables page (hide sensitive values)
3. **Check database status**: Run the Turso CLI commands to verify database is accessible

## Other Common Issues

### Build Fails

**Error**: "Cannot find module '@prisma/client'"
**Solution**: Ensure `prisma generate` runs during build (already configured in `vercel.json`)

### Slow Performance

**Cause**: Cold starts on serverless functions
**Solution**: This is normal for serverless - first request is slower

### Images Not Loading

**Cause**: File upload path configuration
**Solution**: Check `lib/storage` configuration for your upload method

## Need More Help?

Check these resources:
- Vercel Documentation: https://vercel.com/docs
- Turso Documentation: https://docs.turso.tech
- NextAuth Documentation: https://next-auth.js.org
- Prisma Documentation: https://www.prisma.io/docs
