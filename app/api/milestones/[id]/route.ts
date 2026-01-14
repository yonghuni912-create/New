import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addDays } from 'date-fns';

// Update a milestone and cascade to related tasks
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
    const { date } = body;

    if (!date) {
      return NextResponse.json({ error: 'Missing date' }, { status: 400 });
    }

    // Get the current milestone
    const milestone = await prisma.milestone.findUnique({
      where: { id }
    });

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    const oldDate = new Date(milestone.date);
    const newDate = new Date(date);
    const deltaDays = Math.round((newDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));

    // Update the milestone
    await prisma.milestone.update({
      where: { id },
      data: { date: newDate }
    });

    // If the milestone type is OPEN_DATE, update all related tasks
    if (milestone.type === 'OPEN_DATE' && deltaDays !== 0) {
      const tasks = await prisma.task.findMany({
        where: {
          storeId: milestone.storeId,
          manualOverride: false
        }
      });

      for (const task of tasks) {
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

      // Also update the planned open date
      await prisma.plannedOpenDate.create({
        data: {
          storeId: milestone.storeId,
          date: newDate,
          reason: 'Milestone date changed',
          changedBy: (session.user as any).id || 'system'
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update milestone' }, { status: 500 });
  }
}
