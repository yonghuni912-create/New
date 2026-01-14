import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - List all ingredient templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeItems = searchParams.get('includeItems') === 'true';

    const templates = await prisma.ingredientTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: includeItems ? {
        items: {
          include: {
            ingredient: true
          },
          orderBy: [
            { ingredient: { category: 'asc' } },
            { ingredient: { koreanName: 'asc' } }
          ]
        }
      } : undefined
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Failed to fetch ingredient templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST - Create new ingredient template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, country, description, storeIds, currency } = body;

    if (!name) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    // Create the template
    const template = await prisma.ingredientTemplate.create({
      data: {
        name,
        country: country || null,
        description: description || null,
        storeIds: storeIds ? storeIds.join(',') : null,
        isActive: true
      }
    });

    // Get all master ingredients and create template items
    const ingredients = await prisma.ingredientMaster.findMany();
    
    const defaultCurrency = currency || 
      (country === 'MX' ? 'MXN' : country === 'CO' ? 'COP' : 'CAD');

    for (const ing of ingredients) {
      await prisma.ingredientTemplateItem.create({
        data: {
          templateId: template.id,
          ingredientId: ing.id,
          price: 0,
          currency: defaultCurrency
        }
      });
    }

    // Return template with items
    const fullTemplate = await prisma.ingredientTemplate.findUnique({
      where: { id: template.id },
      include: {
        items: {
          include: {
            ingredient: true
          }
        }
      }
    });

    return NextResponse.json(fullTemplate, { status: 201 });
  } catch (error) {
    console.error('Failed to create ingredient template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
