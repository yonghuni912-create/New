import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - Get single template with items
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
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const template = await prisma.ingredientTemplate.findUnique({
      where: { id },
      include: {
        items: {
          where: category ? {
            ingredient: { category }
          } : undefined,
          include: {
            ingredient: true
          },
          orderBy: [
            { ingredient: { category: 'asc' } },
            { ingredient: { koreanName: 'asc' } }
          ]
        }
      }
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Failed to fetch ingredient template:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

// PUT - Update template metadata
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
    const { name, country, description, storeIds, isActive } = body;

    const template = await prisma.ingredientTemplate.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(country !== undefined && { country }),
        ...(description !== undefined && { description }),
        ...(storeIds !== undefined && { storeIds: Array.isArray(storeIds) ? storeIds.join(',') : storeIds }),
        ...(isActive !== undefined && { isActive })
      }
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('Failed to update ingredient template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

// DELETE - Delete template
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

    await prisma.ingredientTemplate.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete ingredient template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
