import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAuditLog } from '@/lib/auditLog';
import { hasPermission } from '@/lib/rbac';
import { ApiErrors } from '@/lib/apiResponse';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return ApiErrors.unauthorized();
  }

  try {
    const groups = await prisma.inventoryGroup.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { periods: true }
        }
      }
    });
    return NextResponse.json(groups);
  } catch (error: unknown) {
    console.error('Error fetching inventory groups:', error);
    return ApiErrors.serverError(error);
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return ApiErrors.unauthorized();
  }

  const userRole = (session.user as any)?.role;
  if (!hasPermission(userRole, 'canCreate')) {
    return ApiErrors.forbidden('Create permission required');
  }

  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return ApiErrors.badRequest('Group name is required');
    }

    const group = await prisma.inventoryGroup.create({
      data: {
        name,
      },
    });

    // Audit log
    await createAuditLog({
      userId: (session.user as any).id,
      action: 'MANUAL_CREATE',
      entityType: 'InventoryGroup',
      entityId: group.id,
      oldValue: null,
      newValue: { name } as any,
    });

    return NextResponse.json(group);
  } catch (error: unknown) {
    console.error('Error creating inventory group:', error);
    return ApiErrors.serverError(error);
  }
}
