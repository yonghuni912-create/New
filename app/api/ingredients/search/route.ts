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

      const result = templateItems.map((item: any) => ({
        id: item.ingredient.id,
        name: item.ingredient.englishName,
        nameKo: item.ingredient.koreanName,
        category: item.ingredient.category,
        baseUnit: item.ingredient.unit,
        yieldRate: item.ingredient.yieldRate,
        price: item.price,
        currency: item.currency
      }));

      return NextResponse.json(result);
    }

    // No templateId - search all ingredients
    const ingredients = await prisma.ingredientMaster.findMany({
      where: {
        OR: [
          { koreanName: { contains: query } },
          { englishName: { contains: query } }
        ]
      },
      select: {
        id: true,
        koreanName: true,
        englishName: true,
        category: true,
        unit: true,
        yieldRate: true
      },
      take: limit,
      orderBy: [
        { englishName: 'asc' }
      ]
    });

    const result = ingredients.map((ing: any) => ({
      id: ing.id,
      name: ing.englishName,
      nameKo: ing.koreanName,
      category: ing.category,
      baseUnit: ing.unit,
      yieldRate: ing.yieldRate,
      price: null,
      currency: null
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error searching ingredients:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
