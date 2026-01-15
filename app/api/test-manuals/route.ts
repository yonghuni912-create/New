import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result: any = {
    timestamp: new Date().toISOString(),
  };

  try {
    const db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });

    // Test simple query
    const manuals = await db.execute(`
      SELECT id, name, koreanName, sellingPrice, shelfLife, isActive, isArchived
      FROM MenuManual
      ORDER BY name
      LIMIT 10
    `);
    
    result.manuals = manuals.rows;
    result.count = manuals.rows.length;

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({
      ...result,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
    });
  }
}
