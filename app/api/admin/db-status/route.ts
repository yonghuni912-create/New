import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@libsql/client';

export const dynamic = 'force-dynamic';

// Turso free tier limits
const TURSO_FREE_STORAGE_BYTES = 9 * 1024 * 1024 * 1024; // 9GB
const TURSO_FREE_ROW_READS = 1_000_000_000; // 1B reads/month

function getDbClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;
  return createClient({ url, authToken });
}

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const role = (session.user as any)?.role;
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const db = getDbClient();
    if (!db) {
      return NextResponse.json({
        status: 'NOT_CONFIGURED',
        message: 'Database not configured',
        env: {
          hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
          hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
          hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        },
      });
    }

    // Get table counts
    const tables = [
      'User', 'Store', 'Task', 'Milestone', 'TaskCategory',
      'StoreFile', 'AuditLog', 'Notification', 'IngredientMaster',
      'IngredientTemplate', 'IngredientTemplateItem', 'ManualCostVersion',
    ];

    const tableCounts: Record<string, number> = {};
    const missingTables: string[] = [];

    for (const table of tables) {
      try {
        const result = await db.execute({
          sql: `SELECT COUNT(*) as count FROM "${table}"`,
          args: [],
        });
        const count = result.rows[0]?.count;
        tableCounts[table] = typeof count === 'bigint' ? Number(count) : (count as number);
      } catch {
        missingTables.push(table);
      }
    }

    // Get database size info
    let dbInfo = null;
    let storageInfo = null;
    try {
      const infoResult = await db.execute({
        sql: "SELECT name FROM sqlite_master WHERE type='table'",
        args: [],
      });
      dbInfo = {
        tableCount: infoResult.rows.length,
        tables: infoResult.rows.map((r) => r.name),
      };

      // Calculate database size using PRAGMA
      const pageCountResult = await db.execute({ sql: 'PRAGMA page_count', args: [] });
      const pageSizeResult = await db.execute({ sql: 'PRAGMA page_size', args: [] });
      const pageCount = Number(pageCountResult.rows[0]?.page_count || 0);
      const pageSize = Number(pageSizeResult.rows[0]?.page_size || 4096);
      const usedBytes = pageCount * pageSize;

      storageInfo = {
        usedBytes,
        usedMB: Math.round(usedBytes / (1024 * 1024) * 100) / 100,
        usedGB: Math.round(usedBytes / (1024 * 1024 * 1024) * 1000) / 1000,
        limitBytes: TURSO_FREE_STORAGE_BYTES,
        limitGB: 9,
        usagePercent: Math.round((usedBytes / TURSO_FREE_STORAGE_BYTES) * 10000) / 100,
        rowReadsLimit: TURSO_FREE_ROW_READS,
      };
    } catch (e) {
      console.error('Failed to get db info:', e);
    }

    return NextResponse.json({
      status: missingTables.length === 0 ? 'HEALTHY' : 'PARTIAL',
      timestamp: new Date().toISOString(),
      tableCounts,
      missingTables,
      dbInfo,
      storageInfo,
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
        hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
      },
    });
  } catch (error) {
    console.error('DB status error:', error);
    return NextResponse.json(
      { status: 'ERROR', error: String(error) },
      { status: 500 }
    );
  }
}
