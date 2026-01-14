import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - Get all checklist items for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const items = await prisma.taskChecklistItem.findMany({
      where: { taskId: id },
      orderBy: { order: 'asc' }
    });

    return NextResponse.json(items);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch checklist' }, { status: 500 });
  }
}

// POST - Create a new checklist item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Get the highest order number
    const lastItem = await prisma.taskChecklistItem.findFirst({
      where: { taskId: id },
      orderBy: { order: 'desc' }
    });

    const item = await prisma.taskChecklistItem.create({
      data: {
        taskId: id,
        content: content.trim(),
        order: (lastItem?.order ?? -1) + 1
      }
    });

    return NextResponse.json(item);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create checklist item' }, { status: 500 });
  }
}

// PATCH - Update checklist item (toggle complete or update content)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { itemId, isCompleted, content } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (typeof isCompleted === 'boolean') updateData.isCompleted = isCompleted;
    if (content !== undefined) updateData.content = content.trim();

    const item = await prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: updateData
    });

    return NextResponse.json(item);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 });
  }
}

// DELETE - Delete a checklist item
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    await prisma.taskChecklistItem.delete({
      where: { id: itemId }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to delete checklist item' }, { status: 500 });
  }
}
