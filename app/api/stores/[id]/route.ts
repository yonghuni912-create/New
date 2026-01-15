import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        files: {
          orderBy: { createdAt: 'desc' },
        },
        tasks: {
          orderBy: { dueDate: 'asc' },
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
