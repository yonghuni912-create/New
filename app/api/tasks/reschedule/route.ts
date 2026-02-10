import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rescheduleTasks, RescheduleMode } from '@/lib/scheduling';
import { createAuditLog } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';

// POST: Reschedule tasks
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { storeId, taskId, deltaDays, mode } = body as {
      storeId: string;
      taskId: string;
      deltaDays: number; // Number of business days to shift (positive = later, negative = earlier)
      mode: RescheduleMode; // 'SINGLE' | 'ALL_BEFORE' | 'ALL_AFTER' | 'ALL'
    };

    if (!storeId || !taskId || deltaDays === undefined || !mode) {
      return NextResponse.json(
        { error: 'storeId, taskId, deltaDays, and mode are required' },
        { status: 400 }
      );
    }

    // Get all tasks for the store
    const tasks = await prisma.task.findMany({
      where: { storeId },
      orderBy: { orderIndex: 'asc' },
    });

    if (tasks.length === 0) {
      return NextResponse.json({ error: 'No tasks found for this store' }, { status: 404 });
    }

    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Calculate new dates
    const tasksWithDates = tasks.map(t => ({
      id: t.id,
      startDate: t.startDate,
      dueDate: t.dueDate,
      orderIndex: t.orderIndex,
    }));

    const rescheduleMap = rescheduleTasks(tasksWithDates, taskId, deltaDays, mode);

    if (rescheduleMap.size === 0) {
      return NextResponse.json({ message: 'No tasks to reschedule' });
    }

    // Update tasks in database
    const updates = await prisma.$transaction(
      Array.from(rescheduleMap.entries()).map(([id, dates]) =>
        prisma.task.update({
          where: { id },
          data: {
            startDate: dates.startDate,
            dueDate: dates.dueDate,
          },
        })
      )
    );

    // Create audit log
    await createAuditLog({
      userId: (session.user as { id?: string })?.id,
      action: 'TASK_UPDATE',
      entityType: 'Task',
      entityId: taskId,
      newValue: {
        storeId,
        mode,
        deltaDays,
        tasksAffected: updates.length,
      },
    });

    return NextResponse.json({
      message: `Rescheduled ${updates.length} tasks by ${deltaDays} business days`,
      updatedCount: updates.length,
      mode,
    });
  } catch (error) {
    console.error('Error rescheduling tasks:', error);
    return NextResponse.json(
      { error: 'Failed to reschedule tasks' },
      { status: 500 }
    );
  }
}
