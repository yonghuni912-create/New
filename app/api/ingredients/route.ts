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

  try {
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
