import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@libsql/client';
import { createAuditLog } from '@/lib/auditLog';
import { hasPermission } from '@/lib/rbac';
import { ApiErrors } from '@/lib/apiResponse';

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
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return ApiErrors.unauthorized();
  }

  try {
    const { id } = await params;
    const db = getDb();
    
    // Get template
    const template = await db.execute({
      sql: 'SELECT * FROM PriceTemplate WHERE id = ?',
      args: [id]
    });

    if (template.rows.length === 0) {
      return ApiErrors.notFound('Template');
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
      args: [id]
    });

    return NextResponse.json({
      ...template.rows[0],
      items: items.rows
    });
  } catch (error: unknown) {
    console.error('Error fetching price template:', error);
    return ApiErrors.serverError(error);
  }
}

// PUT - Update a price template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return ApiErrors.unauthorized();
  }

  const userRole = (session.user as any)?.role;
  if (!hasPermission(userRole, 'canEdit')) {
    return ApiErrors.forbidden('Edit permission required');
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, country, region, currency, description, isActive } = body;
    const db = getDb();
    const now = new Date().toISOString();

    // Get old value for audit log
    const oldTemplate = await db.execute({
      sql: 'SELECT * FROM PriceTemplate WHERE id = ?',
      args: [id]
    });

    await db.execute({
      sql: `UPDATE PriceTemplate 
            SET name = ?, country = ?, region = ?, currency = ?, description = ?, isActive = ?, updatedAt = ?
            WHERE id = ?`,
      args: [name, country, region || null, currency, description || null, isActive ? 1 : 0, now, id]
    });

    // Audit log
    await createAuditLog({
      userId: (session.user as any).id,
      action: 'TEMPLATE_UPDATE',
      entityType: 'PriceTemplate',
      entityId: id,
      oldValue: oldTemplate.rows[0] as any,
      newValue: { name, country, region, currency, description, isActive } as any,
    });

    return NextResponse.json({ message: 'Template updated successfully' });
  } catch (error: unknown) {
    console.error('Error updating price template:', error);
    return ApiErrors.serverError(error);
  }
}

// DELETE - Delete a price template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return ApiErrors.unauthorized();
  }

  const userRole = (session.user as any)?.role;
  if (!hasPermission(userRole, 'canDelete')) {
    return ApiErrors.forbidden('Delete permission required');
  }

  try {
    const { id } = await params;
    const db = getDb();
    
    // Get old value for audit log
    const oldTemplate = await db.execute({
      sql: 'SELECT * FROM PriceTemplate WHERE id = ?',
      args: [id]
    });
    
    // Delete items first (cascade should handle this but be explicit)
    await db.execute({
      sql: 'DELETE FROM PriceTemplateItem WHERE priceTemplateId = ?',
      args: [id]
    });
    
    // Delete template
    await db.execute({
      sql: 'DELETE FROM PriceTemplate WHERE id = ?',
      args: [id]
    });

    // Audit log
    await createAuditLog({
      userId: (session.user as any).id,
      action: 'TEMPLATE_UPDATE',
      entityType: 'PriceTemplate',
      entityId: id,
      oldValue: oldTemplate.rows[0] as any,
      newValue: null,
    });

    return NextResponse.json({ message: 'Template deleted successfully' });
  } catch (error: unknown) {
    console.error('Error deleting price template:', error);
    return ApiErrors.serverError(error);
  }
}
