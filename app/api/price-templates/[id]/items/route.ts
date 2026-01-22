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

function generateId(): string {
  return 'clpti' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// GET - Get all items for a template
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
    
    const items = await db.execute({
      sql: `
        SELECT pti.id, pti.ingredientMasterId, pti.unitPrice, pti.packagingUnit, pti.packagingQty, pti.notes,
               pti.localEnglishName, pti.localKoreanName, pti.localQuantity, pti.localUnit, pti.localYieldRate,
               im.category, im.koreanName, im.englishName, im.quantity, im.unit, im.yieldRate
        FROM PriceTemplateItem pti
        JOIN IngredientMaster im ON pti.ingredientMasterId = im.id
        WHERE pti.priceTemplateId = ?
        ORDER BY im.category, im.koreanName
      `,
      args: [id]
    });

    return NextResponse.json(items.rows);
  } catch (error: unknown) {
    console.error('Error fetching price template items:', error);
    return ApiErrors.serverError(error);
  }
}

// POST - Add item to template
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return ApiErrors.unauthorized();
  }

  const userRole = (session.user as any)?.role;
  if (!hasPermission(userRole, 'canCreate')) {
    return ApiErrors.forbidden('Create permission required');
  }

  try {
    const { id: templateId } = await params;
    const body = await request.json();
    const { ingredientMasterId, unitPrice, packagingUnit, packagingQty, notes, localKoreanName, localEnglishName } = body;

    if (!ingredientMasterId) {
      return ApiErrors.badRequest('ingredientMasterId is required');
    }

    const db = getDb();
    const id = generateId();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO PriceTemplateItem (id, priceTemplateId, ingredientMasterId, unitPrice, packagingUnit, packagingQty, notes, localKoreanName, localEnglishName, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, templateId, ingredientMasterId, unitPrice || 0, packagingUnit || null, packagingQty || null, notes || null, localKoreanName || null, localEnglishName || null, now, now]
    });

    // Audit log
    await createAuditLog({
      userId: (session.user as any).id,
      action: 'PRICE_UPDATE',
      entityType: 'PriceTemplateItem',
      entityId: id,
      oldValue: null,
      newValue: { ingredientMasterId, unitPrice, packagingUnit, packagingQty, notes, localKoreanName, localEnglishName } as any,
    });

    return NextResponse.json({ id, message: 'Item added successfully' });
  } catch (error: unknown) {
    console.error('Error adding price template item:', error);
    return ApiErrors.serverError(error);
  }
}

// PUT - Bulk update items
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
    const { id: templateId } = await params;
    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items)) {
      return ApiErrors.badRequest('items array is required');
    }

    const db = getDb();
    const now = new Date().toISOString();

    for (const item of items) {
      if (item.id) {
        await db.execute({
          sql: `UPDATE PriceTemplateItem 
                SET unitPrice = ?, packagingUnit = ?, packagingQty = ?, notes = ?,
                    localEnglishName = ?, localKoreanName = ?, localQuantity = ?, localUnit = ?, localYieldRate = ?,
                    updatedAt = ?
                WHERE id = ? AND priceTemplateId = ?`,
          args: [
            item.unitPrice || 0, 
            item.packagingUnit || null, 
            item.packagingQty || null, 
            item.notes || null, 
            item.localEnglishName || null,
            item.localKoreanName || null,
            item.localQuantity || null,
            item.localUnit || null,
            item.localYieldRate || null,
            now, 
            item.id, 
            templateId
          ]
        });
      }
    }

    // Audit log for bulk update
    await createAuditLog({
      userId: (session.user as any).id,
      action: 'PRICE_UPDATE',
      entityType: 'PriceTemplateItem',
      entityId: templateId,
      oldValue: null,
      newValue: { itemCount: items.length } as any,
    });

    return NextResponse.json({ message: 'Items updated successfully', count: items.length });
  } catch (error: unknown) {
    console.error('Error updating price template items:', error);
    return ApiErrors.serverError(error);
  }
}
