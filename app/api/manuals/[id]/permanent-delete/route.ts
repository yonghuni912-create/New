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

// DELETE - Permanently delete a manual (Master Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserRole = (session.user as any)?.role;
    const currentUserId = (session.user as any)?.id;
    const currentUserEmail = (session.user as any)?.email;

    // Check if user can permanently delete by role OR by special email
    const canDelete = hasPermission(currentUserRole, 'canPermanentDelete') || 
      currentUserEmail === 'admin@bbq.com' || 
      currentUserEmail === 'kun.lee@bbqchickenca.com';

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Only Master Admin can permanently delete manuals' },
        { status: 403 }
      );
    }

    const manualId = params.id;

    const db = getDbClient();
    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // Get manual info before deletion
    const manual = await db.execute({
      sql: 'SELECT id, name, koreanName, isArchived FROM "MenuManual" WHERE id = ?',
      args: [manualId],
    });

    if (manual.rows.length === 0) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
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
          'PERMANENT_DELETE',
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

    return NextResponse.json({
      message: 'Manual permanently deleted',
      deletedManual: {
        id: manualId,
        name: manualData.name,
      },
    });
  } catch (error) {
    console.error('Permanent delete manual error:', error);
    return NextResponse.json({ error: 'Failed to permanently delete manual' }, { status: 500 });
  }
}
