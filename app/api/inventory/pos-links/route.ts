import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAuditLog } from '@/lib/auditLog';
import { hasPermission } from '@/lib/rbac';
import { ApiErrors } from '@/lib/apiResponse';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return ApiErrors.unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId');

  if (!groupId) {
    return ApiErrors.badRequest('Group ID is required');
  }

  try {
    const links = await prisma.posMenuLink.findMany({
      where: { groupId },
      include: {
        manual: {
          select: {
            id: true,
            name: true,
            koreanName: true,
          }
        }
      },
      orderBy: { posMenuName: 'asc' },
    });
    return NextResponse.json(links);
  } catch (error: unknown) {
    console.error('Error fetching POS links:', error);
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
    const { groupId, posMenuName, menuManualId } = body;

    if (!groupId || !posMenuName || !menuManualId) {
      return ApiErrors.badRequest('Missing required fields');
    }

    // Upsert: 이미 존재하면 업데이트, 없으면 생성
    const link = await prisma.posMenuLink.upsert({
      where: {
        groupId_posMenuName: {
          groupId,
          posMenuName,
        },
      },
      update: {
        menuManualId,
      },
      create: {
        groupId,
        posMenuName,
        menuManualId,
      },
      include: {
        manual: true,
      }
    });

    // Audit log
    await createAuditLog({
      userId: (session.user as any).id,
      action: 'MANUAL_CREATE',
      entityType: 'PosMenuLink',
      entityId: link.id,
      oldValue: null,
      newValue: { groupId, posMenuName, menuManualId } as any,
    });

    return NextResponse.json(link);
  } catch (error: unknown) {
    console.error('Error creating/updating POS link:', error);
    return ApiErrors.serverError(error);
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return ApiErrors.unauthorized();
  }

  const userRole = (session.user as any)?.role;
  if (!hasPermission(userRole, 'canDelete')) {
    return ApiErrors.forbidden('Delete permission required');
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return ApiErrors.badRequest('ID is required');
  }

  try {
    // Get old value for audit log
    const oldLink = await prisma.posMenuLink.findUnique({ where: { id } });

    await prisma.posMenuLink.delete({
      where: { id },
    });

    // Audit log
    await createAuditLog({
      userId: (session.user as any).id,
      action: 'STORE_DELETE',
      entityType: 'PosMenuLink',
      entityId: id,
      oldValue: oldLink as any,
      newValue: null,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting POS link:', error);
    return ApiErrors.serverError(error);
  }
}
