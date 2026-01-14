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
        tempName: data.tempName || null,
        officialName: data.officialName || null,
        country: data.country,
        city: data.city || null,
        address: data.address || null,
        timezone: data.timezone,
        storePhone: data.storePhone || null,
        storeEmail: data.storeEmail || null,
        ownerName: data.ownerName || null,
        ownerPhone: data.ownerPhone || null,
        ownerEmail: data.ownerEmail || null,
        ownerAddress: data.ownerAddress || null,
        status: data.status || 'PLANNING',
        createdBy: data.createdBy,
        ...(data.plannedOpenDate && {
          plannedOpenDates: {
            create: {
              date: new Date(data.plannedOpenDate),
              reason: data.openDateReason || 'Initial planned date',
              changedBy: data.createdBy,
            },
          },
        }),
      },
      include: {
        plannedOpenDates: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'Store',
        entityId: store.id,
        action: 'CREATE',
        changedBy: user.id,
        afterJson: JSON.stringify(store),
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
