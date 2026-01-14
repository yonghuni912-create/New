import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() || '';

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Search stores
    const stores = await prisma.store.findMany({
      where: {
        OR: [
          { tempName: { contains: query } },
          { officialName: { contains: query } },
          { city: { contains: query } },
          { country: { contains: query } },
        ],
      },
      take: 5,
    });

    // Search manuals (Turso schema uses nameKo)
    const manuals = await prisma.menuManual.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { nameKo: { contains: query } },
        ],
      },
      take: 5,
    });

    // Search ingredients
    const ingredients = await prisma.ingredientMaster.findMany({
      where: {
        OR: [
          { englishName: { contains: query } },
          { koreanName: { contains: query } },
        ],
      },
      take: 5,
    });

    const results = [
      ...stores.map((store) => ({
        type: 'store' as const,
        id: store.id,
        title: store.officialName || store.tempName || 'Unnamed Store',
        subtitle: `${store.city}, ${store.country}`,
        href: `/dashboard/stores/${store.id}`,
      })),
      ...manuals.map((manual) => ({
        type: 'manual' as const,
        id: manual.id,
        title: manual.name,
        subtitle: manual.nameKo || 'Menu Manual',
        href: `/dashboard/templates?manual=${manual.id}`,
      })),
      ...ingredients.map((ing) => ({
        type: 'ingredient' as const,
        id: ing.id,
        title: ing.englishName,
        subtitle: ing.koreanName || 'Ingredient',
        href: `/dashboard/pricing?ingredient=${ing.id}`,
      })),
    ];

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
