
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const period = await prisma.inventoryPeriod.findUnique({
      where: { id },
      include: {
        group: true,
        items: {
          include: {
            ingredient: true,
          },
          orderBy: {
            ingredient: {
              englishName: 'asc',
            },
          },
        },
      },
    });

    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    return NextResponse.json(period);
  } catch (error) {
    console.error('Error fetching inventory period details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory period details' },
      { status: 500 }
    );
  }
}
