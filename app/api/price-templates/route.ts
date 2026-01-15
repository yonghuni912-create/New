import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@libsql/client';

export const dynamic = 'force-dynamic';

function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
}

function generateId(): string {
  return 'clpt' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// GET - List all price templates or get one by id
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeItems = searchParams.get('includeItems') === 'true';

  try {
    const db = getDb();
    
    const templates = await db.execute(`
      SELECT id, name, country, region, currency, description, isActive, createdAt, updatedAt
      FROM PriceTemplate
      WHERE isActive = 1
      ORDER BY country, name
    `);

    let result = templates.rows;

    if (includeItems) {
      // Get items for each template
      for (let i = 0; i < result.length; i++) {
        const items = await db.execute({
          sql: `
            SELECT pti.id, pti.ingredientMasterId, pti.unitPrice, pti.packagingUnit, pti.packagingQty, pti.notes,
                   im.category, im.koreanName, im.englishName, im.quantity, im.unit, im.yieldRate
            FROM PriceTemplateItem pti
            JOIN IngredientMaster im ON pti.ingredientMasterId = im.id
            WHERE pti.priceTemplateId = ?
            ORDER BY im.category, im.koreanName
          `,
          args: [result[i].id]
        });
        (result[i] as any).items = items.rows;
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching price templates:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create a new price template
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, country, region, currency, description, copyFromMaster } = body;

    if (!name || !country) {
      return NextResponse.json({ error: 'Name and country are required' }, { status: 400 });
    }

    const db = getDb();
    const id = generateId();
    const now = new Date().toISOString();

    // Create template
    await db.execute({
      sql: `INSERT INTO PriceTemplate (id, name, country, region, currency, description, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [id, name, country, region || null, currency || 'CAD', description || null, now, now]
    });

    // If copyFromMaster, copy all ingredients from IngredientMaster with 0 price
    if (copyFromMaster) {
      const ingredients = await db.execute('SELECT id FROM IngredientMaster');
      
      for (const ing of ingredients.rows) {
        const itemId = generateId();
        await db.execute({
          sql: `INSERT INTO PriceTemplateItem (id, priceTemplateId, ingredientMasterId, unitPrice, createdAt, updatedAt)
                VALUES (?, ?, ?, 0, ?, ?)`,
          args: [itemId, id, ing.id, now, now]
        });
      }
    }

    return NextResponse.json({ 
      id, 
      name, 
      country, 
      region, 
      currency: currency || 'CAD',
      message: 'Price template created successfully' 
    });
  } catch (error: any) {
    console.error('Error creating price template:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
