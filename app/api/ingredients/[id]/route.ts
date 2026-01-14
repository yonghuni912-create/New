import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - Get single ingredient
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const ingredient = await prisma.ingredientMaster.findUnique({
      where: { id },
      include: {
        templateItems: {
          include: {
            template: true
          }
        }
      }
    });

    if (!ingredient) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
    }

    return NextResponse.json(ingredient);
  } catch (error) {
    console.error('Failed to fetch ingredient:', error);
    return NextResponse.json({ error: 'Failed to fetch ingredient' }, { status: 500 });
  }
}

// PUT - Update master ingredient
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { category, koreanName, englishName, quantity, unit, yieldRate } = body;

    const ingredient = await prisma.ingredientMaster.update({
      where: { id },
      data: {
        ...(category && { category }),
        ...(koreanName && { koreanName }),
        ...(englishName && { englishName }),
        ...(quantity !== undefined && { quantity }),
        ...(unit && { unit }),
        ...(yieldRate !== undefined && { yieldRate })
      }
    });

    return NextResponse.json(ingredient);
  } catch (error) {
    console.error('Failed to update ingredient:', error);
    return NextResponse.json({ error: 'Failed to update ingredient' }, { status: 500 });
  }
}

// DELETE - Delete master ingredient (cascades to template items)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.ingredientMaster.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete ingredient:', error);
    return NextResponse.json({ error: 'Failed to delete ingredient' }, { status: 500 });
  }
}
