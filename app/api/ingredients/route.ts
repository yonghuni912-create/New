import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - List all master ingredients
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const where = category ? { category } : {};

    const ingredients = await prisma.ingredientMaster.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { koreanName: 'asc' }
      ]
    });

    // Get unique categories
    const categories = await prisma.ingredientMaster.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' }
    });

    return NextResponse.json({
      ingredients,
      categories: categories.map(c => c.category)
    });
  } catch (error) {
    console.error('Failed to fetch ingredients:', error);
    return NextResponse.json({ error: 'Failed to fetch ingredients' }, { status: 500 });
  }
}

// POST - Create new master ingredient (also adds to all templates)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { category, koreanName, englishName, quantity, unit, yieldRate } = body;

    if (!category || !koreanName || !englishName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create master ingredient
    const ingredient = await prisma.ingredientMaster.create({
      data: {
        category,
        koreanName,
        englishName,
        quantity: quantity || 0,
        unit: unit || 'g',
        yieldRate: yieldRate || 100
      }
    });

    // Add to all existing templates
    const templates = await prisma.ingredientTemplate.findMany();
    
    for (const template of templates) {
      const currency = template.country === 'MX' ? 'MXN' 
        : template.country === 'CO' ? 'COP' 
        : 'CAD';
      
      await prisma.ingredientTemplateItem.create({
        data: {
          templateId: template.id,
          ingredientId: ingredient.id,
          price: 0,
          currency
        }
      });
    }

    return NextResponse.json(ingredient, { status: 201 });
  } catch (error) {
    console.error('Failed to create ingredient:', error);
    return NextResponse.json({ error: 'Failed to create ingredient' }, { status: 500 });
  }
}
