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
    const { 
      status, 
      startDate, 
      dueDate, 
      title, 
      description, 
      priority, 
      assigneeId,
      category,
      subcategory,
      durationDays,
      daysBeforeOpening,
      isMilestone,
      completedAt
    } = body;

    // Get the current task for audit log
    const currentTask = await prisma.task.findUnique({ 
      where: { id },
      select: { id: true, status: true, title: true, priority: true, completedAt: true }
    });

    const updateData: any = {};
    if (status !== undefined) {
      updateData.status = status;
      // Auto-set completedAt when status changes to DONE or COMPLETED
      if ((status === 'DONE' || status === 'COMPLETED') && !currentTask?.completedAt) {
        updateData.completedAt = new Date();
      } else if (status !== 'DONE' && status !== 'COMPLETED') {
        updateData.completedAt = null;
      }
    }
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId || null;
    if (category !== undefined) updateData.category = category;
    if (subcategory !== undefined) updateData.subcategory = subcategory;
    if (durationDays !== undefined) updateData.durationDays = durationDays;
    if (daysBeforeOpening !== undefined) updateData.daysBeforeOpening = daysBeforeOpening;
    if (isMilestone !== undefined) updateData.isMilestone = isMilestone;
    if (completedAt !== undefined) updateData.completedAt = completedAt ? new Date(completedAt) : null;

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        startDate: true,
        dueDate: true,
        completedAt: true,
        category: true,
        subcategory: true,
        durationDays: true,
        daysBeforeOpening: true,
        isMilestone: true,
        assignee: {
          select: { id: true, name: true, email: true }
        }
      }
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
      select: {
        id: true,
        storeId: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        startDate: true,
        dueDate: true,
        completedAt: true,
        category: true,
        subcategory: true,
        durationDays: true,
        daysBeforeOpening: true,
        isMilestone: true,
        orderIndex: true,
        store: {
          select: { id: true, storeName: true, storeCode: true }
        },
        assignee: {
          select: { id: true, name: true, email: true }
        },
        comments: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true } }
          },
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
    const deletedTask = await prisma.task.findUnique({ 
      where: { id },
      select: { id: true, title: true, status: true }
    });

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
