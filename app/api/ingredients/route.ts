import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - List/Search ingredients
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search') || searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '100');
  const priceTemplateId = searchParams.get('priceTemplateId');

  try {
    // 특정 가격 템플릿(국가)의 식재료 조회
    if (priceTemplateId) {
      // PriceTemplateItem과 IngredientMaster를 조인하여 해당 국가의 식재료 가져오기
      const templateItems = await prisma.priceTemplateItem.findMany({
        where: {
          priceTemplateId,
          ...(search ? {
            OR: [
              { ingredientMaster: { koreanName: { contains: search } } },
              { ingredientMaster: { englishName: { contains: search } } },
              { localKoreanName: { contains: search } },
              { localEnglishName: { contains: search } },
            ]
          } : {}),
          ...(category ? {
            ingredientMaster: { category }
          } : {})
        },
        include: {
          ingredientMaster: true
        },
        take: limit,
        orderBy: [
          { ingredientMaster: { category: 'asc' } },
          { ingredientMaster: { koreanName: 'asc' } }
        ]
      });

      // PriceTemplateItem 형식을 IngredientMaster 형식과 유사하게 변환
      const ingredients = templateItems.map(item => ({
        id: item.ingredientMasterId,
        category: item.ingredientMaster.category,
        koreanName: item.localKoreanName || item.ingredientMaster.koreanName,
        englishName: item.localEnglishName || item.ingredientMaster.englishName,
        quantity: item.localQuantity || item.ingredientMaster.quantity,
        unit: item.localUnit || item.ingredientMaster.unit,
        yieldRate: item.localYieldRate || item.ingredientMaster.yieldRate,
        unitPrice: item.unitPrice,
        packagingUnit: item.packagingUnit,
        packagingQty: item.packagingQty,
        priceTemplateItemId: item.id,
        // 원본 마스터 정보도 포함
        master: {
          koreanName: item.ingredientMaster.koreanName,
          englishName: item.ingredientMaster.englishName,
        }
      }));

      return NextResponse.json(ingredients);
    }

    // 기본: IngredientMaster 전체 조회
    const where: any = {};
    
    if (category) {
      where.category = category;
    }
    
    if (search) {
      where.OR = [
        { koreanName: { contains: search } },
        { englishName: { contains: search } },
        { category: { contains: search } }
      ];
    }

    const ingredients = await prisma.ingredientMaster.findMany({
      where,
      take: limit,
      orderBy: [
        { category: 'asc' },
        { koreanName: 'asc' }
      ]
    });

    return NextResponse.json(ingredients);
  } catch (error: any) {
    console.error('Error fetching ingredients:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch ingredients',
      details: error?.message 
    }, { status: 500 });
  }
}

// POST - Create new ingredient
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { 
      category, 
      koreanName, 
      englishName, 
      quantity,
      unit, 
      yieldRate,
      imageUrl
    } = body;

    if (!koreanName || !englishName || !unit) {
      return NextResponse.json({ 
        error: 'Missing required fields: koreanName, englishName, unit' 
      }, { status: 400 });
    }

    const ingredient = await prisma.ingredientMaster.create({
      data: {
        category: category || 'Others',
        koreanName,
        englishName,
        quantity: quantity || 0,
        unit,
        yieldRate: yieldRate || 100,
        imageUrl: imageUrl || null
      }
    });

    return NextResponse.json(ingredient, { status: 201 });
  } catch (error: any) {
    console.error('Error creating ingredient:', error);
    return NextResponse.json({ 
      error: 'Failed to create ingredient',
      details: error?.message 
    }, { status: 500 });
  }
}
