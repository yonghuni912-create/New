
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const groups = await prisma.inventoryGroup.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { periods: true }
        }
      }
    });
    return NextResponse.json(groups);
  } catch (error) {
    console.error('Error fetching inventory groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory groups' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      );
    }

    const group = await prisma.inventoryGroup.create({
      data: {
        name,
      },
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error('Error creating inventory group:', error);
    return NextResponse.json(
      { error: 'Failed to create inventory group' },
      { status: 500 }
    );
  }
}
