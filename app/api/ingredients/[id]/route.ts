import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auditLog';
import { hasPermission } from '@/lib/rbac';
import { ApiErrors, getErrorMessage } from '@/lib/apiResponse';

export const dynamic = 'force-dynamic';

// GET - Get single ingredient
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
    const ingredient = await prisma.ingredientMaster.findUnique({
      where: { id },
      include: {
        manualIngredients: {
          include: {
            manual: true
          }
        }
      }
    });

    if (!ingredient) {
      return ApiErrors.notFound('Ingredient');
    }

    return NextResponse.json(ingredient);
  } catch (error: unknown) {
    console.error('Error fetching ingredient:', error);
    return ApiErrors.serverError(error);
  }
}

// PUT - Update ingredient
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
    const { category, koreanName, englishName, quantity, unit, yieldRate, imageUrl } = body;

    // Get current state for audit log
    const oldIngredient = await prisma.ingredientMaster.findUnique({
      where: { id }
    });

    if (!oldIngredient) {
      return ApiErrors.notFound('Ingredient');
    }

    const ingredient = await prisma.ingredientMaster.update({
      where: { id },
      data: {
        ...(category !== undefined && { category }),
        ...(koreanName !== undefined && { koreanName }),
        ...(englishName !== undefined && { englishName }),
        ...(quantity !== undefined && { quantity: parseFloat(quantity) || 0 }),
        ...(unit !== undefined && { unit }),
        ...(yieldRate !== undefined && { yieldRate: parseFloat(yieldRate) || 100 }),
        ...(imageUrl !== undefined && { imageUrl })
      }
    });

    // Audit log
    await createAuditLog({
      userId: (session.user as any).id,
      action: 'MANUAL_UPDATE',
      entityType: 'IngredientMaster',
      entityId: id,
      oldValue: oldIngredient as any,
      newValue: ingredient as any,
    });

    return NextResponse.json(ingredient);
  } catch (error: unknown) {
    console.error('Error updating ingredient:', error);
    return ApiErrors.serverError(error);
  }
}

// DELETE - Delete ingredient
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
    
    // Get ingredient for audit log before deletion
    const ingredient = await prisma.ingredientMaster.findUnique({
      where: { id }
    });

    if (!ingredient) {
      return ApiErrors.notFound('Ingredient');
    }

    await prisma.ingredientMaster.delete({
      where: { id }
    });

    // Audit log
    await createAuditLog({
      userId: (session.user as any).id,
      action: 'MANUAL_DELETE',
      entityType: 'IngredientMaster',
      entityId: id,
      oldValue: ingredient as any,
      newValue: null,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting ingredient:', error);
    return ApiErrors.serverError(error);
  }
}

