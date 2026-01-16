# Security Review - BBQ Franchise Platform

## Issues Found

### 🔴 CRITICAL: Password Storage in localStorage

**Location**: `app/login/page.tsx` (lines 24, 33, 91, 94)

**Issue**: The application stores plaintext passwords in browser localStorage for "Auto Login" feature.

**Code:**
```typescript
// Lines 24, 33 - Reading password from localStorage
const savedPassword = localStorage.getItem('savedPassword');

// Lines 91, 94 - Storing password in localStorage
localStorage.setItem('savedPassword', password);
```

**Risk Level**: 🔴 **CRITICAL**

**Security Impact:**
1. **Plaintext Password Storage**: Passwords are stored unencrypted in browser storage
2. **XSS Vulnerability**: If an XSS attack occurs, passwords can be easily stolen
3. **Shared Device Risk**: Anyone with access to the browser can read localStorage
4. **Browser Extensions**: Malicious extensions can access localStorage data
5. **Compliance Issues**: Violates security best practices and may breach compliance requirements

**Recommendation**: 
- **Remove the "Auto Login" feature** that stores passwords
- Keep only "Remember Email" feature
- Use NextAuth's session management for persistent login (already configured with 30-day sessions)

**Alternative Solution (if Auto Login is required):**
- Use HTTP-only cookies (managed by NextAuth)
- Implement refresh tokens
- Never store actual passwords client-side

### ⚠️ MEDIUM: Weak NEXTAUTH_SECRET

**Location**: `.env.production`, Vercel environment variables

**Issue**: Using a simple, predictable secret: `"secret0707"`

**Risk Level**: ⚠️ **MEDIUM**

**Security Impact:**
1. JWT tokens can be forged if secret is compromised
2. Session hijacking possible
3. Predictable secret easier to guess

**Recommendation**:
Generate a cryptographically secure secret:
```bash
openssl rand -base64 32
```

**Current**: `secret0707`
**Should be**: Something like `kJ8x2mP9qL5nR7tY3vW1zB6cN4hF0gD8eS2aM5kP7qL9tX3vZ1`

### ✅ Good Security Practices Found

1. ✅ **Passwords Hashed**: Using bcryptjs with 10 rounds (line 50 in seed.ts)
2. ✅ **JWT Sessions**: Using JWT strategy instead of database sessions
3. ✅ **HTTPS**: Deployment URL uses HTTPS
4. ✅ **Environment Variables**: Sensitive data in env vars (not hardcoded)
5. ✅ **Credentials Provider**: Proper error messages (don't leak user existence)

## Priority Fixes

### Priority 1: Remove Password Storage (CRITICAL)

**File**: `app/login/page.tsx`

Remove these lines:
- Line 24: `const savedPassword = localStorage.getItem('savedPassword');`
- Line 33: `setPassword(savedPassword);`
- Line 91: `localStorage.setItem('savedPassword', password);`
- Line 94: `localStorage.removeItem('savedPassword');`
- Lines 158-170: Remove "Auto Login" checkbox UI

Keep only:
- "Remember Email" feature (safe - only stores email)
- NextAuth's session management handles persistent login

### Priority 2: Update NEXTAUTH_SECRET (MEDIUM)

Generate new secret and update in:
1. `.env.production`
2. Vercel environment variables
3. Redeploy

### Priority 3: Add Security Headers

Consider adding these to `next.config.js`:

```javascript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};
```

## Security Checklist for Production

- [ ] Remove password storage from localStorage
- [ ] Generate strong NEXTAUTH_SECRET
- [ ] Add security headers
- [ ] Enable HTTPS only (already done in Vercel)
- [ ] Review all localStorage usage
- [ ] Implement rate limiting on login endpoint
- [ ] Add CSRF protection (NextAuth provides this)
- [ ] Regular security audits
- [ ] Keep dependencies updated

## Summary

**Critical Issue**: Password storage in localStorage must be removed before production use.

**Current State**: 
- Application works but has security vulnerability
- Database authentication is secure (bcrypt hashing)
- Session management is good (JWT with NextAuth)
- Main issue is client-side password storage

**Recommended Action**:
1. Remove "Auto Login" feature immediately
2. Update NEXTAUTH_SECRET to stronger value
3. Test that normal login still works
4. Document that NextAuth sessions last 30 days (users stay logged in)
