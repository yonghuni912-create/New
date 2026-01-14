import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateStoreTimeline, AnchorDates } from '@/lib/scheduling';

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

    // Get store with open date
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        plannedOpenDates: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        tasks: true,
      },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const openDate = store.plannedOpenDates[0]?.date;

    if (!openDate) {
      return NextResponse.json(
        { error: 'Store has no planned open date set. Please set an open date first.' },
        { status: 400 }
      );
    }

    // Check if tasks already exist
    if (store.tasks.length > 0) {
      return NextResponse.json(
        { error: 'Tasks already exist for this store. Delete existing tasks first to regenerate.' },
        { status: 400 }
      );
    }

    // Generate timeline tasks
    const anchorDates: AnchorDates = {
      OPEN_DATE: openDate,
      // CONTRACT_SIGNED and CONSTRUCTION_START will be auto-derived in generateStoreTimeline
    };

    const generatedTasks = generateStoreTimeline(anchorDates);

    // Create tasks in database
    const createdTasks = await prisma.$transaction(
      generatedTasks.map((task) =>
        prisma.task.create({
          data: {
            title: task.title,
            phase: task.phase,
            startDate: task.startDate,
            dueDate: task.dueDate,
            status: task.status,
            priority: task.priority,
            sourceType: task.sourceType,
            calendarRule: task.calendarRule,
            storeId: id,
          },
        })
      )
    );

    // Redirect back to timeline page
    return NextResponse.redirect(new URL(`/dashboard/stores/${id}/timeline`, request.url));
  } catch (error) {
    console.error('Error generating tasks:', error);
    return NextResponse.json(
      { error: 'Failed to generate tasks' },
      { status: 500 }
    );
  }
}
