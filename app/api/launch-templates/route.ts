import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: List all launch task templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const templateName = searchParams.get('templateName') || 'DEFAULT';

    const templates = await prisma.launchTaskTemplate.findMany({
      where: { templateName, isActive: true },
      orderBy: { orderIndex: 'asc' },
    });

    // Get unique template names
    const allTemplates = await prisma.launchTaskTemplate.findMany({
      select: { templateName: true },
      distinct: ['templateName'],
    });

    return NextResponse.json({
      templates,
      templateNames: allTemplates.map(t => t.templateName),
    });
  } catch (error) {
    console.error('Error fetching launch templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch launch templates' },
      { status: 500 }
    );
  }
}

// POST: Create/Import launch task templates
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { templateName, tasks } = body as {
      templateName: string;
      tasks: {
        orderIndex: number;
        category: string;
        subcategory: string | null;
        title: string;
        durationDays: number;
        daysBeforeOpening: number;
      }[];
    };

    if (!templateName || !tasks || !Array.isArray(tasks)) {
      return NextResponse.json(
        { error: 'templateName and tasks array are required' },
        { status: 400 }
      );
    }

    // Delete existing templates with same name (if overwriting)
    await prisma.launchTaskTemplate.deleteMany({
      where: { templateName },
    });

    // Create new templates
    const createdTemplates = await prisma.$transaction(
      tasks.map((task) =>
        prisma.launchTaskTemplate.create({
          data: {
            templateName,
            orderIndex: task.orderIndex,
            category: task.category,
            subcategory: task.subcategory,
            title: task.title,
            durationDays: task.durationDays,
            daysBeforeOpening: task.daysBeforeOpening,
            isActive: true,
          },
        })
      )
    );

    return NextResponse.json({
      message: `Created ${createdTemplates.length} launch task templates`,
      count: createdTemplates.length,
    });
  } catch (error) {
    console.error('Error creating launch templates:', error);
    return NextResponse.json(
      { error: 'Failed to create launch templates' },
      { status: 500 }
    );
  }
}
