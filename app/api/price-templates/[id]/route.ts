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

// GET - Get a single price template with items
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
    
    // Get template
    const template = await db.execute({
      sql: 'SELECT * FROM PriceTemplate WHERE id = ?',
      args: [params.id]
    });

    if (template.rows.length === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Get items with ingredient details
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

    return NextResponse.json({
      ...template.rows[0],
      items: items.rows
    });
  } catch (error: any) {
    console.error('Error fetching price template:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update a price template
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
    const { name, country, region, currency, description, isActive } = body;
    const db = getDb();
    const now = new Date().toISOString();

    await db.execute({
      sql: `UPDATE PriceTemplate 
            SET name = ?, country = ?, region = ?, currency = ?, description = ?, isActive = ?, updatedAt = ?
            WHERE id = ?`,
      args: [name, country, region || null, currency, description || null, isActive ? 1 : 0, now, params.id]
    });

    return NextResponse.json({ message: 'Template updated successfully' });
  } catch (error: any) {
    console.error('Error updating price template:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete a price template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    
    // Delete items first (cascade should handle this but be explicit)
    await db.execute({
      sql: 'DELETE FROM PriceTemplateItem WHERE priceTemplateId = ?',
      args: [params.id]
    });
    
    // Delete template
    await db.execute({
      sql: 'DELETE FROM PriceTemplate WHERE id = ?',
      args: [params.id]
    });

    return NextResponse.json({ message: 'Template deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting price template:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
