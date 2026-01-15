import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Update a task
export async function PATCH(
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
    const { status, dueDate, title, description, priority, assigneeId } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (dueDate) updateData.dueDate = new Date(dueDate);
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority) updateData.priority = priority;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;

    const task = await prisma.task.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json(task);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// Get a task
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
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        store: true,
        assignee: true,
        comments: {
          include: { user: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

// Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Delete task dependencies first
    await prisma.taskDependency.deleteMany({
      where: {
        OR: [
          { taskId: id },
          { dependsOnId: id }
        ]
      }
    });

    // Delete the task
    await prisma.task.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
