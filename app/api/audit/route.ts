import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'Missing entityType or entityId' }, { status: 400 });
  }

  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType,
        entityId
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return NextResponse.json(logs);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
