import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - List template items
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

    const items = await prisma.ingredientTemplateItem.findMany({
      where: { templateId: id },
      include: {
        ingredient: true
      }
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error('Failed to fetch template items:', error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}

// PUT - Bulk update template items
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
    const { items } = body; // Array of { itemId, ...fields }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Items array required' }, { status: 400 });
    }

    // Verify template exists
    const template = await prisma.ingredientTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const results = [];
    for (const item of items) {
      const { itemId, ...fields } = item;
      
      const updated = await prisma.ingredientTemplateItem.update({
        where: { id: itemId },
        data: {
          ...(fields.category !== undefined && { category: fields.category }),
          ...(fields.koreanName !== undefined && { koreanName: fields.koreanName }),
          ...(fields.englishName !== undefined && { englishName: fields.englishName }),
          ...(fields.quantity !== undefined && { quantity: fields.quantity }),
          ...(fields.unit !== undefined && { unit: fields.unit }),
          ...(fields.yieldRate !== undefined && { yieldRate: fields.yieldRate }),
          ...(fields.price !== undefined && { price: fields.price }),
          ...(fields.currency !== undefined && { currency: fields.currency }),
          ...(fields.notes !== undefined && { notes: fields.notes })
        }
      });
      
      results.push(updated);
    }

    return NextResponse.json({ updated: results.length, items: results });
  } catch (error) {
    console.error('Failed to bulk update template items:', error);
    return NextResponse.json({ error: 'Failed to update items' }, { status: 500 });
  }
}
