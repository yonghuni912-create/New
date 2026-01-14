import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canCreateStore } from '@/lib/rbac';
import { AuditAction } from '@/lib/enums';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const countriesOnly = searchParams.get('countriesOnly') === 'true';

    if (countriesOnly) {
      const countries = await prisma.country.findMany({
        orderBy: { name: 'asc' },
      });
      return NextResponse.json(countries);
    }

    const stores = await prisma.store.findMany({
      include: {
        country: true,
        _count: {
          select: {
            tasks: true,
            files: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
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

    const user = session.user as any;
    if (!canCreateStore(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      storeCode,
      storeName,
      countryId,
      address,
      city,
      state,
      postalCode,
      franchiseeEmail,
      franchiseeName,
      franchiseePhone,
      plannedOpenDate,
      estimatedRevenue,
      initialInvestment,
      notes,
    } = body;

    const store = await prisma.store.create({
      data: {
        storeCode,
        storeName,
        countryId,
        address,
        city,
        state,
        postalCode,
        franchiseeEmail,
        franchiseeName,
        franchiseePhone,
        plannedOpenDate: plannedOpenDate ? new Date(plannedOpenDate) : null,
        estimatedRevenue: estimatedRevenue ? parseFloat(estimatedRevenue) : null,
        initialInvestment: initialInvestment ? parseFloat(initialInvestment) : null,
        notes,
      },
      include: {
        country: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.CREATE,
        entityType: 'Store',
        entityId: store.id,
        changes: JSON.stringify({ created: store }),
      },
    });

    return NextResponse.json(store, { status: 201 });
  } catch (error) {
    console.error('Error creating store:', error);
    return NextResponse.json({ error: 'Failed to create store' }, { status: 500 });
  }
}
