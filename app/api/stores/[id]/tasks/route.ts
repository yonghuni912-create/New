import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Create a new task for a store
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
    const { title, startDate, dueDate, phase } = body;

    if (!title || !startDate || !dueDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        storeId: id,
        title,
        description: phase ? `Phase: ${phase}` : null,
        dueDate: new Date(dueDate),
        status: 'TODO',
        priority: 'MEDIUM'
      }
    });

    return NextResponse.json(task);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

// Get all tasks for a store
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tasks = await prisma.task.findMany({
      where: { storeId: id },
      orderBy: { dueDate: 'asc' }
    });

    return NextResponse.json(tasks);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}
