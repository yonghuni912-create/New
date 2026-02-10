import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        files: {
          orderBy: { createdAt: 'desc' },
        },
        tasks: {
          orderBy: [{ orderIndex: 'asc' }, { dueDate: 'asc' }],
          select: {
            id: true,
            storeId: true,
            phaseId: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            category: true,
            subcategory: true,
            startDate: true,
            dueDate: true,
            assigneeId: true,
            assignee: {
              select: { id: true, name: true, email: true }
            },
            orderIndex: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { comments: true }
            }
          }
        },
      },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json(store);
  } catch (error: any) {
    console.error('Error fetching store:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch store' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };

    if (!['ADMIN', 'PM', 'CONTRIBUTOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    const { id } = await params;

    // Get the current store for audit log
    const currentStore = await prisma.store.findUnique({
      where: { id },
    });

    if (!currentStore) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const store = await prisma.store.update({
      where: { id },
      data: {
        storeName: data.storeName || data.tempName || null,
        storeCode: data.storeCode || undefined,
        country: data.country,
        city: data.city || null,
        address: data.address || null,
        franchiseePhone: data.franchiseePhone || data.storePhone || null,
        franchiseeEmail: data.franchiseeEmail || data.storeEmail || null,
        franchiseeName: data.franchiseeName || data.ownerName || null,
        status: data.status,
      },
      include: {
        files: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'Store',
        entityId: store.id,
        action: 'UPDATE',
        userId: user.id,
        oldValue: JSON.stringify(currentStore),
        newValue: JSON.stringify(store),
      },
    });

    return NextResponse.json(store);
  } catch (error: any) {
    console.error('Error updating store:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update store' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a store
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };

    // Only ADMIN can delete stores
    if (!['ADMIN', 'MASTER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Only admins can delete stores' }, { status: 403 });
    }

    const { id } = await params;

    // Get the store for audit log
    const store = await prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Delete the store (cascade will handle related records)
    await prisma.store.delete({
      where: { id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'Store',
        entityId: id,
        action: 'DELETE',
        userId: user.id,
        oldValue: JSON.stringify(store),
      },
    });

    return NextResponse.json({ message: 'Store deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting store:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete store' },
      { status: 500 }
    );
  }
}
