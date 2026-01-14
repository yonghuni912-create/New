import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditStore } from '@/lib/rbac';
import { AuditAction } from '@/lib/enums';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const store = await prisma.store.findUnique({
      where: { id: params.id },
      include: {
        country: true,
        plannedOpenDates: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        milestones: {
          orderBy: { targetDate: 'asc' },
        },
        files: {
          orderBy: { createdAt: 'desc' },
        },
        tasks: {
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                comments: true,
                checklistItems: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json(store);
  } catch (error) {
    console.error('Error fetching store:', error);
    return NextResponse.json({ error: 'Failed to fetch store' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (!canEditStore(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      storeName,
      address,
      city,
      state,
      postalCode,
      franchiseeEmail,
      franchiseeName,
      franchiseePhone,
      status,
      plannedOpenDate,
      actualOpenDate,
      estimatedRevenue,
      initialInvestment,
      notes,
    } = body;

    const existingStore = await prisma.store.findUnique({
      where: { id: params.id },
    });

    if (!existingStore) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const updatedStore = await prisma.store.update({
      where: { id: params.id },
      data: {
        storeName,
        address,
        city,
        state,
        postalCode,
        franchiseeEmail,
        franchiseeName,
        franchiseePhone,
        status,
        plannedOpenDate: plannedOpenDate ? new Date(plannedOpenDate) : null,
        actualOpenDate: actualOpenDate ? new Date(actualOpenDate) : null,
        estimatedRevenue: estimatedRevenue ? parseFloat(estimatedRevenue) : null,
        initialInvestment: initialInvestment ? parseFloat(initialInvestment) : null,
        notes,
      },
      include: {
        country: true,
      },
    });

    // If planned open date changed, record it
    if (plannedOpenDate && existingStore.plannedOpenDate?.toISOString() !== new Date(plannedOpenDate).toISOString()) {
      await prisma.plannedOpenDate.create({
        data: {
          storeId: params.id,
          oldDate: existingStore.plannedOpenDate,
          newDate: new Date(plannedOpenDate),
          reason: 'Updated via store edit',
          changedBy: user.email,
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'Store',
        entityId: params.id,
        changes: JSON.stringify({
          before: existingStore,
          after: updatedStore,
        }),
      },
    });

    return NextResponse.json(updatedStore);
  } catch (error) {
    console.error('Error updating store:', error);
    return NextResponse.json({ error: 'Failed to update store' }, { status: 500 });
  }
}
