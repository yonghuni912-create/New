import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Search ingredients with optional price info
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const ingredients = await prisma.ingredientMaster.findMany({
      where: {
        OR: [
          { koreanName: { contains: query } },
          { englishName: { contains: query } },
          { category: { contains: query } }
        ]
      },
      take: limit,
      orderBy: { koreanName: 'asc' }
    });

    // Transform to match expected format
    const results = ingredients.map(ing => ({
      id: ing.id,
      koreanName: ing.koreanName,
      englishName: ing.englishName,
      category: ing.category,
      unit: ing.unit,
      yieldRate: ing.yieldRate,
      quantity: ing.quantity,
      // Note: Price info would come from IngredientTemplate if implemented
      price: null,
      currency: null
    }));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error searching ingredients:', error);
    return NextResponse.json({ 
      error: 'Failed to search ingredients',
      details: error?.message 
    }, { status: 500 });
  }
}
