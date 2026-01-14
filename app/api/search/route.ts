import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (!query || query.length < 2) {
      return NextResponse.json({ stores: [], manuals: [], ingredients: [] });
    }

    const [stores, manuals, ingredients] = await Promise.all([
      prisma.store.findMany({
        where: {
          OR: [
            { storeCode: { contains: query } },
            { storeName: { contains: query } },
            { city: { contains: query } },
            { franchiseeName: { contains: query } },
          ],
        },
        include: {
          country: true,
        },
        take: 10,
      }),
      prisma.menuManual.findMany({
        where: {
          OR: [
            { menuCode: { contains: query } },
            { menuNameEn: { contains: query } },
            { menuNameLocal: { contains: query } },
          ],
        },
        take: 10,
      }),
      prisma.ingredientMaster.findMany({
        where: {
          OR: [
            { code: { contains: query } },
            { nameEn: { contains: query } },
            { nameLocal: { contains: query } },
          ],
        },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      stores,
      manuals,
      ingredients,
    });
  } catch (error) {
    console.error('Error searching:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
