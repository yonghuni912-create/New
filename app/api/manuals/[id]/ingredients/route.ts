import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// POST /api/manuals/[id]/ingredients - Add new ingredient to manual
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any)?.role;
  if (!hasPermission(userRole, 'canEdit')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id: manualId } = await params;
  
  try {
    const body = await request.json();
    const { name, koreanName, quantity, unit, ingredientId, notes } = body;
    
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    
    // Check manual exists
    const manual = await prisma.menuManual.findUnique({
      where: { id: manualId },
      include: { ingredients: true }
    });
    
    if (!manual) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }
    
    // Get next sort order
    const maxSortOrder = manual.ingredients.reduce((max, ing) => Math.max(max, ing.sortOrder || 0), 0);
    
    // Create new ingredient
    const newIngredient = await prisma.manualIngredient.create({
      data: {
        manualId,
        name,
        koreanName: koreanName || name,
        quantity: quantity || 0,
        unit: unit || 'g',
        ingredientId: ingredientId || null,
        notes: notes || null,
        sortOrder: maxSortOrder + 1,
        section: 'MAIN'
      }
    });
    
    console.log(`✅ Added ingredient "${name}" to manual ${manualId}`);
    
    return NextResponse.json(newIngredient, { status: 201 });
  } catch (error: any) {
    console.error('❌ Error adding ingredient:', error);
    return NextResponse.json(
      { error: 'Failed to add ingredient', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
