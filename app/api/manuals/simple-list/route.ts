
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
    const manuals = await prisma.menuManual.findMany({
      where: { 
        isActive: true,
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        koreanName: true,
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(manuals);
  } catch (error) {
    console.error('Error fetching manuals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manuals' },
      { status: 500 }
    );
  }
}
