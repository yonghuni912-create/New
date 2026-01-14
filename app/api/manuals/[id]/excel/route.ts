import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const manual = await prisma.menuManual.findUnique({
      where: { id },
      include: {
        ingredients: {
          orderBy: { sortOrder: 'asc' },
          include: { ingredientMaster: true }
        },
        costVersions: {
          include: { template: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!manual) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }

    // Return JSON data - Excel generation can be added later
    return NextResponse.json({
      message: 'Excel export feature - coming soon',
      manual: {
        id: manual.id,
        name: manual.name,
        nameKo: manual.nameKo,
        yield: manual.yield,
        ingredientCount: manual.ingredients.length
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 });
  }
}