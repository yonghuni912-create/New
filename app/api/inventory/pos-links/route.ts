
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId');

  if (!groupId) {
    return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
  }

  try {
    const links = await prisma.posMenuLink.findMany({
      where: { groupId },
      include: {
        manual: {
          select: {
            id: true,
            name: true,
            koreanName: true,
          }
        }
      },
      orderBy: { posMenuName: 'asc' },
    });
    return NextResponse.json(links);
  } catch (error) {
    console.error('Error fetching POS links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch POS links' },
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
    const { groupId, posMenuName, menuManualId } = body;

    if (!groupId || !posMenuName || !menuManualId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Upsert: 이미 존재하면 업데이트, 없으면 생성
    const link = await prisma.posMenuLink.upsert({
      where: {
        groupId_posMenuName: {
          groupId,
          posMenuName,
        },
      },
      update: {
        menuManualId,
      },
      create: {
        groupId,
        posMenuName,
        menuManualId,
      },
      include: {
        manual: true,
      }
    });

    return NextResponse.json(link);
  } catch (error) {
    console.error('Error creating/updating POS link:', error);
    return NextResponse.json(
      { error: 'Failed to save POS link' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    await prisma.posMenuLink.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting POS link:', error);
    return NextResponse.json(
      { error: 'Failed to delete POS link' },
      { status: 500 }
    );
  }
}
