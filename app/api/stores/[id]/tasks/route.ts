import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auditLog';
import { hasPermission } from '@/lib/rbac';
import { ApiErrors } from '@/lib/apiResponse';

export const dynamic = 'force-dynamic';

// Create a new task for a store
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    const userRole = (session.user as any)?.role;
    if (!hasPermission(userRole, 'canCreate')) {
      return ApiErrors.forbidden('Create permission required');
    }

    const { id } = await params;
    const body = await request.json();
    const { title, startDate, dueDate, phase } = body;

    if (!title || !startDate || !dueDate) {
      return ApiErrors.badRequest('Missing required fields');
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

    // Audit log
    await createAuditLog({
      userId: (session.user as any).id,
      action: 'MANUAL_CREATE',
      entityType: 'Task',
      entityId: task.id,
      oldValue: null,
      newValue: { title, storeId: id, phase } as any,
    });

    return NextResponse.json(task);
  } catch (e: unknown) {
    console.error(e);
    return ApiErrors.serverError(e);
  }
}

// Get all tasks for a store
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;

    const tasks = await prisma.task.findMany({
      where: { storeId: id },
      orderBy: { dueDate: 'asc' }
    });

    return NextResponse.json(tasks);
  } catch (e: unknown) {
    console.error(e);
    return ApiErrors.serverError(e);
  }
}
