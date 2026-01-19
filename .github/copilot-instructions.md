# Copilot Instructions - BBQ Franchise Management Platform

## Architecture Overview

This is a **Next.js 14 App Router** application for managing BBQ Chicken franchise store openings. Key architectural decisions:

- **Dual Database Strategy**: SQLite for local development, Turso (edge SQLite) for production. The [lib/prisma.ts](lib/prisma.ts) handles this automatically via `@prisma/adapter-libsql`.
- **API Routes**: All use `export const dynamic = 'force-dynamic'` to ensure fresh data (required for Turso compatibility).
- **Role-Based Access Control**: 4 roles (`ADMIN`, `PM`, `CONTRIBUTOR`, `VIEWER`) defined in [lib/rbac.ts](lib/rbac.ts).

## Critical Patterns

### API Route Pattern
```typescript
// Always include these at the top of API routes
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';  // Required for all API routes

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... implementation
}
```

### Audit Logging
All mutations must create audit logs using `createAuditLog()` from [lib/auditLog.ts](lib/auditLog.ts). Actions are typed (`MANUAL_CREATE`, `STORE_UPDATE`, etc.).

### Storage Adapter
File storage uses an adapter pattern ([lib/storage/](lib/storage/)) supporting both local filesystem and S3.

## Database Schema Notes

- **MenuManual**: Core entity with `isMaster` flag (master manuals vs template copies), `isActive`/`isArchived` for soft-delete.
- **ManualIngredient**: Links manuals to ingredients with `ingredientId` for master ingredient linking.
- **PriceTemplate**: Country-specific pricing with currency support.

Schema location: [prisma/schema.prisma](prisma/schema.prisma)

## Key Developer Commands

```bash
npm run dev          # Start dev server with SQLite
npm run db:push      # Push schema to database
npm run db:seed      # Seed with demo data
npm run db:studio    # Open Prisma Studio GUI
npm run test         # Run Vitest unit tests
npm run test:e2e     # Run Playwright tests
```

## Project-Specific Conventions

1. **Korean/English Naming**: Many entities have both `koreanName` and English `name` fields for bilingual support.
2. **Cooking Method Storage**: Stored as JSON string array of `{process, manual, translatedManual}` steps.
3. **Component Location**: UI primitives in [components/ui/](components/ui/), feature components in [components/](components/).
4. **Excel Parsing**: Uses `xlsx` (SheetJS) for Excel import in [app/dashboard/templates/page.tsx](app/dashboard/templates/page.tsx).

## Demo Accounts (after seeding)

- Admin: `admin@bbq.com` / `admin123`
- PM: `pm@bbq.com` / `pm123`
- User: `user@bbq.com` / `user123`

## Deployment

Production deploys to Vercel. Environment variables required:
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` - Database
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` - Authentication

See [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions.
