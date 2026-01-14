import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Search ingredients by Korean or English name
// Optional: templateId parameter to include price from that template
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '10');
  const templateId = searchParams.get('templateId');

  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    // If templateId is provided, search within template items only
    if (templateId) {
      const templateItems = await prisma.ingredientTemplateItem.findMany({
        where: {
          templateId,
          ingredient: {
            OR: [
              { koreanName: { contains: query } },
              { englishName: { contains: query } }
            ]
          }
        },
        include: {
          ingredient: {
            select: {
              id: true,
              englishName: true,
              koreanName: true,
              category: true,
              unit: true,
              yieldRate: true
            }
          }
        },
        take: limit,
        orderBy: {
          ingredient: { englishName: 'asc' }
        }
      });

      // Format result with prices from template
      const result = templateItems.map((item: any) => ({
        id: item.ingredient.id,
        name: item.ingredient.englishName,
        englishName: item.ingredient.englishName,
        koreanName: item.ingredient.koreanName,
        category: item.ingredient.category,
        unit: item.ingredient.unit,
        yieldRate: item.ingredient.yieldRate,
        price: item.price,
        currency: item.currency
      }));

      return NextResponse.json(result);
    }

    // Default search without template - search all ingredients
    const ingredients = await prisma.ingredientMaster.findMany({
      where: {
        OR: [
          { koreanName: { contains: query } },
          { englishName: { contains: query } }
        ]
      },
      take: limit,
      orderBy: { englishName: 'asc' }
    });

    // Format result
    const result = ingredients.map((ing: any) => ({
      id: ing.id,
      name: ing.englishName,
      englishName: ing.englishName,
      koreanName: ing.koreanName,
      category: ing.category,
      unit: ing.unit,
      yieldRate: ing.yieldRate,
      price: null,
      currency: null
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Ingredient search error:', error);
    return NextResponse.json({ error: 'Failed to search ingredients' }, { status: 500 });
  }
}