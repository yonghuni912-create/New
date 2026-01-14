import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addDays } from 'date-fns';

// Update a task (reschedule)
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
    const { newStartDate, policy, status } = body;

    // If just updating status
    if (status && !newStartDate) {
      const task = await prisma.task.update({
        where: { id },
        data: { status }
      });
      return NextResponse.json(task);
    }

    if (!newStartDate || !policy) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Get the current task
    const currentTask = await prisma.task.findUnique({
      where: { id }
    });

    if (!currentTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const oldStartDate = currentTask.startDate;
    const newStart = new Date(newStartDate);
    const deltaDays = Math.round((newStart.getTime() - new Date(oldStartDate).getTime()) / (1000 * 60 * 60 * 24));

    // Calculate new due date maintaining duration
    const duration = currentTask.dueDate
      ? Math.round((new Date(currentTask.dueDate).getTime() - new Date(oldStartDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const newDueDate = addDays(newStart, duration);

    if (policy === 'THIS_ONLY') {
      // Update only this task
      await prisma.task.update({
        where: { id },
        data: {
          startDate: newStart,
          dueDate: newDueDate,
          manualOverride: true
        }
      });
    } else if (policy === 'CASCADE_LATER') {
      // Update this task and all tasks that start after it in the same store
      await prisma.task.update({
        where: { id },
        data: {
          startDate: newStart,
          dueDate: newDueDate,
          manualOverride: true
        }
      });

      // Get all later tasks
      const laterTasks = await prisma.task.findMany({
        where: {
          storeId: currentTask.storeId,
          id: { not: id },
          startDate: { gt: oldStartDate }
        }
      });

      // Update each later task
      for (const task of laterTasks) {
        if (task.manualOverride) continue; // Skip manually overridden tasks

        const taskDuration = task.dueDate
          ? Math.round((new Date(task.dueDate).getTime() - new Date(task.startDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        await prisma.task.update({
          where: { id: task.id },
          data: {
            startDate: addDays(task.startDate, deltaDays),
            dueDate: addDays(task.startDate, deltaDays + taskDuration)
          }
        });
      }
    } else if (policy === 'CASCADE_ALL') {
      // Update all tasks in the same store
      const allTasks = await prisma.task.findMany({
        where: { storeId: currentTask.storeId }
      });

      for (const task of allTasks) {
        if (task.id === id) {
          await prisma.task.update({
            where: { id },
            data: {
              startDate: newStart,
              dueDate: newDueDate,
              manualOverride: true
            }
          });
        } else if (!task.manualOverride) {
          const taskDuration = task.dueDate
            ? Math.round((new Date(task.dueDate).getTime() - new Date(task.startDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          await prisma.task.update({
            where: { id: task.id },
            data: {
              startDate: addDays(task.startDate, deltaDays),
              dueDate: addDays(task.startDate, deltaDays + taskDuration)
            }
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to reschedule' }, { status: 500 });
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
          { dependsOnTaskId: id }
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
