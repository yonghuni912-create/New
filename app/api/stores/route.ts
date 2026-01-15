import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const countriesOnly = searchParams.get('countriesOnly') === 'true';

  try {
    if (countriesOnly) {
      const countries = await prisma.country.findMany({
        orderBy: { name: 'asc' }
      });
      return NextResponse.json(countries);
    }

    const stores = await prisma.store.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tasks: {
          select: { status: true }
        }
      }
    });
    return NextResponse.json(stores);
  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };

    if (!['ADMIN', 'PM'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();

    const store = await prisma.store.create({
      data: {
        storeCode: data.storeCode || `STORE-${Date.now()}`,
        storeName: data.storeName || data.tempName || 'New Store',
        countryId: data.countryId,
        country: data.country || 'CA',
        city: data.city || null,
        address: data.address || null,
        franchiseePhone: data.franchiseePhone || data.storePhone || null,
        franchiseeEmail: data.franchiseeEmail || data.storeEmail || null,
        franchiseeName: data.franchiseeName || data.ownerName || null,
        status: data.status || 'PLANNING',
        plannedOpenDate: data.plannedOpenDate ? new Date(data.plannedOpenDate) : null,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'Store',
        entityId: store.id,
        action: 'CREATE',
        userId: user.id,
        newValue: JSON.stringify(store),
      },
    });

    return NextResponse.json(store);
  } catch (error: any) {
    console.error('Error creating store:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create store' },
      { status: 500 }
    );
  }
}
