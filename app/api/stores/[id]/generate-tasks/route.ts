import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateLaunchTasks, generateStoreTimeline, AnchorDates } from '@/lib/scheduling';

export const dynamic = 'force-dynamic';

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

    // Get request body for template selection (optional)
    let templateName = 'DEFAULT';
    let useLaunchTemplate = true;
    
    try {
      const body = await request.json();
      if (body.templateName) templateName = body.templateName;
      if (body.useLegacy) useLaunchTemplate = false;
    } catch {
      // Body is optional, use defaults
    }

    // Get store with open date
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        tasks: true,
      },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const openDate = store.plannedOpenDate;

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

    // Try to use LaunchTaskTemplate first
    if (useLaunchTemplate) {
      const launchTemplates = await prisma.launchTaskTemplate.findMany({
        where: { templateName, isActive: true },
        orderBy: { orderIndex: 'asc' },
      });

      if (launchTemplates.length > 0) {
        // Generate tasks from launch templates
        const generatedTasks = generateLaunchTasks(openDate, launchTemplates);

        // Create tasks in database
        const createdTasks = await prisma.$transaction(
          generatedTasks.map((task, index) =>
            prisma.task.create({
              data: {
                title: task.title,
                description: task.subcategory || undefined,
                startDate: task.startDate,
                dueDate: task.dueDate,
                status: 'TODO',
                priority: task.priority,
                category: task.category,
                subcategory: task.subcategory,
                durationDays: task.durationDays,
                daysBeforeOpening: task.daysBeforeOpening,
                orderIndex: task.orderIndex,
                storeId: id,
                launchTemplateId: task.launchTemplateId,
              },
            })
          )
        );

        return NextResponse.json({
          message: `Generated ${createdTasks.length} tasks from launch template "${templateName}"`,
          count: createdTasks.length,
          templateUsed: templateName,
        });
      }
    }

    // Fallback to legacy timeline generation
    const anchorDates: AnchorDates = {
      OPEN_DATE: openDate,
    };

    const generatedTasks = generateStoreTimeline(anchorDates);

    // Create tasks in database
    const createdTasks = await prisma.$transaction(
      generatedTasks.map((task) =>
        prisma.task.create({
          data: {
            title: task.title,
            description: `Phase: ${task.phase}`,
            startDate: task.startDate,
            dueDate: task.dueDate,
            status: 'TODO',
            priority: task.priority || 'MEDIUM',
            category: task.phase,
            orderIndex: task.order,
            isMilestone: task.isMilestone,
            storeId: id,
          },
        })
      )
    );

    return NextResponse.json({
      message: `Generated ${createdTasks.length} tasks (legacy template)`,
      count: createdTasks.length,
      templateUsed: 'LEGACY',
    });
  } catch (error) {
    console.error('Error generating tasks:', error);
    return NextResponse.json(
      { error: 'Failed to generate tasks' },
      { status: 500 }
    );
  }
}

