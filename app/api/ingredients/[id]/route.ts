import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Get single ingredient
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ingredient = await prisma.ingredientMaster.findUnique({
      where: { id: params.id },
      include: {
        manualIngredients: {
          include: {
            manual: true
          }
        }
      }
    });

    if (!ingredient) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
    }

    return NextResponse.json(ingredient);
  } catch (error: any) {
    console.error('Error fetching ingredient:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch ingredient',
      details: error?.message 
    }, { status: 500 });
  }
}

// PUT - Update ingredient
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
    const { category, koreanName, englishName, quantity, unit, yieldRate, imageUrl } = body;

    const ingredient = await prisma.ingredientMaster.update({
      where: { id: params.id },
      data: {
        ...(category !== undefined && { category }),
        ...(koreanName !== undefined && { koreanName }),
        ...(englishName !== undefined && { englishName }),
        ...(quantity !== undefined && { quantity: parseFloat(quantity) }),
        ...(unit !== undefined && { unit }),
        ...(yieldRate !== undefined && { yieldRate: parseFloat(yieldRate) }),
        ...(imageUrl !== undefined && { imageUrl })
      }
    });

    return NextResponse.json(ingredient);
  } catch (error: any) {
    console.error('Error updating ingredient:', error);
    return NextResponse.json({ 
      error: 'Failed to update ingredient',
      details: error?.message 
    }, { status: 500 });
  }
}

// DELETE - Delete ingredient
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.ingredientMaster.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting ingredient:', error);
    return NextResponse.json({ 
      error: 'Failed to delete ingredient',
      details: error?.message 
    }, { status: 500 });
  }
}
