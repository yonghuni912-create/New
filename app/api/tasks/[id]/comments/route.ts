import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - Get all comments for a task
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

    const comments = await prisma.taskComment.findMany({
      where: { taskId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(comments);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST - Create a new comment
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

    const user = session.user as { id: string };

    const comment = await prisma.taskComment.create({
      data: {
        taskId: id,
        userId: user.id,
        content: content.trim()
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Create notification for task assignee
    const task = await prisma.task.findUnique({
      where: { id },
      select: { assigneeId: true, title: true, store: { select: { tempName: true, officialName: true } } }
    });

    if (task && task.assigneeId && task.assigneeId !== user.id) {
      const storeName = task.store.officialName || task.store.tempName || 'Store';
      await prisma.notification.create({
        data: {
          userId: task.assigneeId,
          type: 'TASK_COMMENT',
          title: 'New Comment on Task',
          message: `${comment.user.name || 'Someone'} commented on "${task.title}" in ${storeName}`,
          payload: JSON.stringify({ taskId: id, commentId: comment.id, storeName }),
          isRead: false
        }
      });
    }

    return NextResponse.json(comment);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}

// DELETE - Delete a comment
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
    }

    const user = session.user as { id: string; role: string };
    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only comment author or admin can delete
    if (comment.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.taskComment.delete({
      where: { id: commentId }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
