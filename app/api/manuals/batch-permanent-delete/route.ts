import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@libsql/client';
import crypto from 'crypto';
import { hasPermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

function getDbClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;
  return createClient({ url, authToken });
}

// POST - Batch permanently delete manuals (Master Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserRole = (session.user as any)?.role;
    const currentUserId = (session.user as any)?.id;
    const currentUserEmail = (session.user as any)?.email;

    // Check if user is master admin by role OR by special email OR has canPermanentDelete permission
    const canDelete = hasPermission(currentUserRole, 'canPermanentDelete') || 
      currentUserEmail === 'admin@bbq.com' || 
      currentUserEmail === 'kun.lee@bbqchickenca.com';

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Only Master Admin can permanently delete manuals' },
        { status: 403 }
      );
    }

    const { manualIds } = await request.json();

    if (!manualIds || !Array.isArray(manualIds) || manualIds.length === 0) {
      return NextResponse.json(
        { error: 'Manual IDs are required' },
        { status: 400 }
      );
    }

    const db = getDbClient();
    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const deletedManuals: { id: string; name: string }[] = [];
    const failedManuals: { id: string; error: string }[] = [];

    for (const manualId of manualIds) {
      try {
        // Get manual info before deletion
        const manual = await db.execute({
          sql: 'SELECT id, name, koreanName, isArchived FROM "MenuManual" WHERE id = ?',
          args: [manualId],
        });

        if (manual.rows.length === 0) {
          failedManuals.push({ id: manualId, error: 'Not found' });
          continue;
        }

        const manualData = manual.rows[0];

        // Delete related ManualIngredient records first
        await db.execute({
          sql: 'DELETE FROM "ManualIngredient" WHERE manualId = ?',
          args: [manualId],
        });

        // Delete related ManualVersion records
        await db.execute({
          sql: 'DELETE FROM "ManualVersion" WHERE manualId = ?',
          args: [manualId],
        });

        // Delete the manual itself
        await db.execute({
          sql: 'DELETE FROM "MenuManual" WHERE id = ?',
          args: [manualId],
        });

        // Log audit
        try {
          await db.execute({
            sql: 'INSERT INTO "AuditLog" (id, userId, action, entityType, entityId, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
            args: [
              crypto.randomUUID(),
              currentUserId || 'system',
              'BATCH_PERMANENT_DELETE',
              'MenuManual',
              manualId,
              JSON.stringify({
                name: manualData.name,
                koreanName: manualData.koreanName,
                wasArchived: manualData.isArchived,
              }),
            ],
          });
        } catch {
          // Audit log is optional
        }

        deletedManuals.push({
          id: manualId,
          name: String(manualData.name),
        });
      } catch (error) {
        failedManuals.push({
          id: manualId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: `Permanently deleted ${deletedManuals.length} manuals`,
      deletedManuals,
      failedManuals,
      totalRequested: manualIds.length,
      totalDeleted: deletedManuals.length,
      totalFailed: failedManuals.length,
    });
  } catch (error) {
    console.error('Batch permanent delete error:', error);
    return NextResponse.json({ error: 'Failed to permanently delete manuals' }, { status: 500 });
  }
}
