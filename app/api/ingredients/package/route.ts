import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST - Update isPackage status for ingredients
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { ingredientIds, isPackage } = body;

    if (!ingredientIds || !Array.isArray(ingredientIds) || ingredientIds.length === 0) {
      return NextResponse.json({ error: 'ingredientIds is required and must be a non-empty array' }, { status: 400 });
    }

    if (typeof isPackage !== 'boolean') {
      return NextResponse.json({ error: 'isPackage must be a boolean' }, { status: 400 });
    }

    // Update all specified ingredients
    const updatePromises = ingredientIds.map(id => 
      prisma.manualIngredient.update({
        where: { id },
        data: { isPackage }
      })
    );

    await Promise.all(updatePromises);

    console.log(`✅ Updated ${ingredientIds.length} ingredients isPackage=${isPackage}`);

    return NextResponse.json({ 
      success: true, 
      updated: ingredientIds.length,
      isPackage 
    });
  } catch (error: any) {
    console.error('❌ Error updating package status:', error);
    return NextResponse.json({ 
      error: 'Failed to update package status',
      details: error?.message 
    }, { status: 500 });
  }
}
