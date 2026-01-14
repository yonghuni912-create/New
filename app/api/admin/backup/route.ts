import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@libsql/client';

export const dynamic = 'force-dynamic';

function getDbClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;
  return createClient({ url, authToken });
}

// GET - Export database tables as JSON (admin only)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any)?.role;
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tables = searchParams.get('tables')?.split(',') || [
      'User', 'Store', 'Task', 'Milestone', 'TaskCategory',
      'IngredientMaster', 'IngredientTemplate', 'IngredientTemplateItem',
    ];

    const db = getDbClient();
    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const backup: Record<string, unknown[]> = {};

    for (const table of tables) {
      try {
        // Don't export passwords
        let sql = `SELECT * FROM "${table}"`;
        if (table === 'User') {
          sql = `SELECT id, email, name, role, createdAt, updatedAt FROM "${table}"`;
        }

        const result = await db.execute({ sql, args: [] });
        backup[table] = result.rows as unknown[];
      } catch (e) {
        console.error(`Failed to backup table ${table}:`, e);
        backup[table] = [];
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="bbq-backup-${timestamp}.json"`,
      },
    });
  } catch (error) {
    console.error('Backup error:', error);
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 });
  }
}

// POST - Verify backup integrity
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any)?.role;
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const backupData = await request.json();

    const verification: Record<string, { valid: boolean; count: number; sample?: unknown }> = {};

    for (const [table, data] of Object.entries(backupData)) {
      if (Array.isArray(data)) {
        verification[table] = {
          valid: true,
          count: data.length,
          sample: data[0] || null,
        };
      } else {
        verification[table] = {
          valid: false,
          count: 0,
        };
      }
    }

    return NextResponse.json({
      message: 'Backup verification complete',
      verification,
      totalTables: Object.keys(verification).length,
      validTables: Object.values(verification).filter((v) => v.valid).length,
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json({ error: 'Failed to verify backup' }, { status: 500 });
  }
}
