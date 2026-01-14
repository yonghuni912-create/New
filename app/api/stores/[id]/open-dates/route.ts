import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
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

    const plannedOpenDate = await prisma.plannedOpenDate.create({
      data: {
        storeId: id,
        date: new Date(data.date),
        reason: data.reason,
        changedBy: data.changedBy,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'PlannedOpenDate',
        entityId: plannedOpenDate.id,
        action: 'CREATE',
        changedBy: user.id,
        afterJson: JSON.stringify(plannedOpenDate),
        reason: data.reason,
      },
    });

    return NextResponse.json(plannedOpenDate);
  } catch (error: any) {
    console.error('Error creating planned open date:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create planned open date' },
      { status: 500 }
    );
  }
}
