import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result: any = {
    timestamp: new Date().toISOString(),
    environment: {
      hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
      hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
      nodeEnv: process.env.NODE_ENV,
    },
  };

  try {
    // Test Turso connection directly
    const { createClient } = require('@libsql/client');
    
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      return NextResponse.json({
        ...result,
        error: 'Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN',
      });
    }

    const db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    // Test simple query
    const tables = await db.execute(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `);
    
    result.tables = tables.rows.map((r: any) => r.name);

    // Try to get MenuManual columns
    try {
      const columns = await db.execute(`PRAGMA table_info(MenuManual)`);
      result.menuManualColumns = columns.rows.map((r: any) => ({
        name: r.name,
        type: r.type,
      }));
    } catch (e: any) {
      result.menuManualColumnsError = e.message;
    }

    // Try to get IngredientMaster columns
    try {
      const columns = await db.execute(`PRAGMA table_info(IngredientMaster)`);
      result.ingredientMasterColumns = columns.rows.map((r: any) => ({
        name: r.name,
        type: r.type,
      }));
    } catch (e: any) {
      result.ingredientMasterColumnsError = e.message;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({
      ...result,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
    });
  }
}
