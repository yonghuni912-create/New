import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auditLog';
import { hasPermission } from '@/lib/rbac';
import { ApiErrors } from '@/lib/apiResponse';

export const dynamic = 'force-dynamic';

// Update a task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    const userRole = (session.user as any)?.role;
    if (!hasPermission(userRole, 'canEdit')) {
      return ApiErrors.forbidden('Edit permission required');
    }

    const { id } = await params;
    const body = await request.json();
    const { status, dueDate, title, description, priority, assigneeId } = body;

    // Get the current task for audit log
    const currentTask = await prisma.task.findUnique({ where: { id } });

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

    // Create audit log
    await createAuditLog({
      userId: (session.user as { id: string }).id,
      action: 'TASK_UPDATE',
      entityType: 'Task',
      entityId: id,
      oldValue: currentTask ? { status: currentTask.status, title: currentTask.title, priority: currentTask.priority } : null,
      newValue: updateData
    });

    return NextResponse.json(task);
  } catch (e: unknown) {
    console.error(e);
    return ApiErrors.serverError(e);
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
      return ApiErrors.unauthorized();
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
      return ApiErrors.notFound('Task');
    }

    return NextResponse.json(task);
  } catch (e: unknown) {
    console.error(e);
    return ApiErrors.serverError(e);
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
      return ApiErrors.unauthorized();
    }

    const userRole = (session.user as any)?.role;
    if (!hasPermission(userRole, 'canDelete')) {
      return ApiErrors.forbidden('Delete permission required');
    }

    const { id } = await params;

    // Get the task for audit log before deleting
    const deletedTask = await prisma.task.findUnique({ where: { id } });

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

    // Create audit log
    await createAuditLog({
      userId: (session.user as { id: string }).id,
      action: 'TASK_DELETE',
      entityType: 'Task',
      entityId: id,
      oldValue: deletedTask ? { title: deletedTask.title, status: deletedTask.status } : null
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error(e);
    return ApiErrors.serverError(e);
  }
}
