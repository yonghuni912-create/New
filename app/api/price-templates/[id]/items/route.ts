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
  return 'clpti' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// GET - Get all items for a template
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    
    const items = await db.execute({
      sql: `
        SELECT pti.id, pti.ingredientMasterId, pti.unitPrice, pti.packagingUnit, pti.packagingQty, pti.notes,
               im.category, im.koreanName, im.englishName, im.quantity, im.unit, im.yieldRate
        FROM PriceTemplateItem pti
        JOIN IngredientMaster im ON pti.ingredientMasterId = im.id
        WHERE pti.priceTemplateId = ?
        ORDER BY im.category, im.koreanName
      `,
      args: [params.id]
    });

    return NextResponse.json(items.rows);
  } catch (error: any) {
    console.error('Error fetching price template items:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Add item to template
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { ingredientMasterId, unitPrice, packagingUnit, packagingQty, notes } = body;

    if (!ingredientMasterId) {
      return NextResponse.json({ error: 'ingredientMasterId is required' }, { status: 400 });
    }

    const db = getDb();
    const id = generateId();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO PriceTemplateItem (id, priceTemplateId, ingredientMasterId, unitPrice, packagingUnit, packagingQty, notes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, params.id, ingredientMasterId, unitPrice || 0, packagingUnit || null, packagingQty || null, notes || null, now, now]
    });

    return NextResponse.json({ id, message: 'Item added successfully' });
  } catch (error: any) {
    console.error('Error adding price template item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Bulk update items
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { items } = body; // Array of { id, unitPrice, packagingUnit, packagingQty, notes }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    const db = getDb();
    const now = new Date().toISOString();

    for (const item of items) {
      if (item.id) {
        await db.execute({
          sql: `UPDATE PriceTemplateItem 
                SET unitPrice = ?, packagingUnit = ?, packagingQty = ?, notes = ?, updatedAt = ?
                WHERE id = ? AND priceTemplateId = ?`,
          args: [item.unitPrice || 0, item.packagingUnit || null, item.packagingQty || null, item.notes || null, now, item.id, params.id]
        });
      }
    }

    return NextResponse.json({ message: 'Items updated successfully', count: items.length });
  } catch (error: any) {
    console.error('Error updating price template items:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
