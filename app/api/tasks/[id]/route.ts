import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditTask, canDeleteTask } from '@/lib/rbac';
import { ReschedulePolicy, AuditAction } from '@/lib/enums';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (!canEditTask(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      description,
      phase,
      status,
      priority,
      assigneeId,
      startDate,
      dueDate,
      completedAt,
      estimatedHours,
      actualHours,
      reschedulePolicy,
    } = body;

    const existingTask = await prisma.task.findUnique({
      where: { id: params.id },
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Handle task rescheduling with cascade logic
    if (reschedulePolicy && (startDate || dueDate)) {
      const policy = reschedulePolicy as ReschedulePolicy;
      
      await prisma.$transaction(async (tx) => {
        // Update the current task
        await tx.task.update({
          where: { id: params.id },
          data: {
            title,
            description,
            phase,
            status,
            priority,
            assigneeId,
            startDate: startDate ? new Date(startDate) : undefined,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            completedAt: completedAt ? new Date(completedAt) : null,
            estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
            actualHours: actualHours ? parseFloat(actualHours) : undefined,
          },
        });

        if (policy === ReschedulePolicy.CASCADE_LATER || policy === ReschedulePolicy.CASCADE_ALL) {
          // Get dependent tasks
          const dependencies = await tx.taskDependency.findMany({
            where: { blockingTaskId: params.id },
            include: { dependentTask: true },
          });

          if (dependencies.length > 0 && dueDate) {
            const daysDiff = existingTask.dueDate
              ? Math.ceil(
                  (new Date(dueDate).getTime() - existingTask.dueDate.getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              : 0;

            // Update dependent tasks
            for (const dep of dependencies) {
              const task = dep.dependentTask;
              if (task.startDate && task.dueDate) {
                const newStartDate = new Date(task.startDate);
                newStartDate.setDate(newStartDate.getDate() + daysDiff);
                const newDueDate = new Date(task.dueDate);
                newDueDate.setDate(newDueDate.getDate() + daysDiff);

                await tx.task.update({
                  where: { id: task.id },
                  data: {
                    startDate: newStartDate,
                    dueDate: newDueDate,
                  },
                });
              }
            }
          }
        }
      });
    } else {
      // Simple update without cascade
      await prisma.task.update({
        where: { id: params.id },
        data: {
          title,
          description,
          phase,
          status,
          priority,
          assigneeId,
          startDate: startDate ? new Date(startDate) : undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          completedAt: completedAt ? new Date(completedAt) : null,
          estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
          actualHours: actualHours ? parseFloat(actualHours) : undefined,
        },
      });
    }

    const updatedTask = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'Task',
        entityId: params.id,
        changes: JSON.stringify({
          before: existingTask,
          after: updatedTask,
        }),
      },
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (!canDeleteTask(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    await prisma.task.delete({
      where: { id: params.id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.DELETE,
        entityType: 'Task',
        entityId: params.id,
        changes: JSON.stringify({ deleted: task }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
