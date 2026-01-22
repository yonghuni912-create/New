# Copilot Instructions - BBQ Franchise Management Platform

## Architecture Overview

Next.js 14 App Router application for BBQ Chicken franchise management. Key patterns:

- **Dual Database**: SQLite (dev) → Turso (prod) via `lib/prisma.ts` with `@prisma/adapter-libsql`
- **RBAC**: 5 roles in `lib/rbac.ts`: `MASTER_ADMIN`, `ADMIN`, `PM`, `CONTRIBUTOR`, `VIEWER`
- **Observability**: OpenTelemetry tracing via `lib/tracing.ts` and `instrumentation.ts`

## Required API Route Pattern

**Every API route MUST follow this pattern:**

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';  // REQUIRED for Turso

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // implementation
}
```

## Critical Domain Patterns

### Master/Copy Manual System
- `isMaster: true` → Original recipe (마스터)
- `isMaster: false` → Country-specific copy linked via `priceTemplateId`
- `masterManualId` → Reference to original master

### Ingredient Linking
- `ingredientId` on `ManualIngredient` → Links to `IngredientMaster`
- Linking status = `ingredientId !== null` (price comes from `PriceTemplateItem`)
- `isPackage: true` on `IngredientMaster` → Packaging item (투고용기), excluded from food cost

### Audit Logging (Required for mutations)
```typescript
await createAuditLog({
  userId: session.user.id,
  action: 'MANUAL_UPDATE',  // See AuditAction type in lib/auditLog.ts
  entityType: 'MenuManual',
  entityId: manual.id,
  oldValue: { name: oldName },
  newValue: { name: newName }
});
```

## Database Schema Essentials

| Model | Key Fields | Notes |
|-------|------------|-------|
| `MenuManual` | `isMaster`, `priceTemplateId`, `category` | Soft-delete via `isArchived` |
| `ManualIngredient` | `ingredientId`, `quantity`, `unit` | `sortOrder` for display |
| `PriceTemplate` | `country`, `currency` | One per country |
| `PriceTemplateItem` | `unitPrice`, `localQuantity` | Country-specific pricing |
| `IngredientMaster` | `category`, `isPackage` | Master ingredient list |

## Key Commands

```bash
npm run dev          # Dev server (SQLite)
npm run db:push      # Push schema changes
npm run db:seed      # Seed demo data
npm run build        # Production build (validates types)
```

## Conventions

1. **Bilingual Fields**: `name` (English) + `koreanName` (Korean) on most entities
2. **JSON Storage**: `cookingMethod` stored as `JSON.stringify([{process, manual, translatedManual}])`
3. **Soft Delete**: Use `isArchived: true`, `deletedAt`, `deletedBy` - never hard delete manuals
4. **File Structure**: API routes in `app/api/`, UI components in `components/ui/`

## Environment Variables

```bash
# Required
DATABASE_URL="file:./prisma/dev.db"     # Local only
TURSO_DATABASE_URL, TURSO_AUTH_TOKEN    # Production
NEXTAUTH_SECRET, NEXTAUTH_URL           # Auth

# Optional (Tracing)
OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_TRACES_ENABLED
```

## Demo Accounts

`admin@bbq.com`/`admin123`, `pm@bbq.com`/`pm123`, `user@bbq.com`/`user123`
