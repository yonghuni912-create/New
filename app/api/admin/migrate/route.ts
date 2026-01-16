import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export const dynamic = 'force-dynamic';

function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
}

// POST - Run database migrations
export async function POST(request: NextRequest) {
  const db = getDb();
  const results: string[] = [];
  const errors: string[] = [];

  // List of migrations to run
  const migrations = [
    {
      name: 'Add unitPrice to ManualIngredient',
      sql: `ALTER TABLE ManualIngredient ADD COLUMN unitPrice REAL`,
    },
    {
      name: 'Add baseQuantity to ManualIngredient',
      sql: `ALTER TABLE ManualIngredient ADD COLUMN baseQuantity REAL`,
    },
    {
      name: 'Add createdAt to ManualIngredient',
      sql: `ALTER TABLE ManualIngredient ADD COLUMN createdAt TEXT DEFAULT (datetime('now'))`,
    },
    {
      name: 'Add updatedAt to ManualIngredient',
      sql: `ALTER TABLE ManualIngredient ADD COLUMN updatedAt TEXT DEFAULT (datetime('now'))`,
    },
    {
      name: 'Create ManualVersion table',
      sql: `CREATE TABLE IF NOT EXISTS ManualVersion (
        id TEXT PRIMARY KEY,
        manualId TEXT NOT NULL,
        version INTEGER NOT NULL,
        name TEXT NOT NULL,
        koreanName TEXT,
        sellingPrice REAL,
        ingredients TEXT,
        cookingMethod TEXT,
        imageUrl TEXT,
        changeNote TEXT,
        changedBy TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (manualId) REFERENCES MenuManual(id) ON DELETE CASCADE
      )`,
    },
    {
      name: 'Add version to MenuManual',
      sql: `ALTER TABLE MenuManual ADD COLUMN version INTEGER DEFAULT 1`,
    },
  ];

  for (const migration of migrations) {
    try {
      await db.execute(migration.sql);
      results.push(`✅ ${migration.name}`);
    } catch (error: any) {
      if (error?.message?.includes('duplicate column name')) {
        results.push(`⏭️ ${migration.name} (already exists)`);
      } else {
        errors.push(`❌ ${migration.name}: ${error?.message}`);
      }
    }
  }

  // Update existing rows that have NULL createdAt/updatedAt
  try {
    await db.execute(`
      UPDATE ManualIngredient 
      SET createdAt = datetime('now'), updatedAt = datetime('now') 
      WHERE createdAt IS NULL OR updatedAt IS NULL
    `);
    results.push(`✅ Updated NULL timestamps`);
  } catch (error: any) {
    errors.push(`❌ Update timestamps: ${error?.message}`);
  }

  return NextResponse.json({
    success: errors.length === 0,
    results,
    errors: errors.length > 0 ? errors : undefined,
  });
}

// GET - Check table structure
export async function GET(request: NextRequest) {
  const db = getDb();

  try {
    const result = await db.execute(`PRAGMA table_info(ManualIngredient)`);
    return NextResponse.json({
      columns: result.rows.map((row: any) => ({
        name: row.name,
        type: row.type,
        notnull: row.notnull,
        default: row.dflt_value,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
