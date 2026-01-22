import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST - Bulk update category for manuals
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { manualIds, category } = body;

    if (!manualIds || !Array.isArray(manualIds) || manualIds.length === 0) {
      return NextResponse.json({ error: 'manualIds is required and must be a non-empty array' }, { status: 400 });
    }

    if (category === undefined) {
      return NextResponse.json({ error: 'category is required' }, { status: 400 });
    }

    // Update all specified manuals
    const result = await prisma.menuManual.updateMany({
      where: { id: { in: manualIds } },
      data: { category: category || null }
    });

    console.log(`✅ Updated ${result.count} manuals with category: ${category}`);

    return NextResponse.json({ 
      success: true, 
      updated: result.count,
      category 
    });
  } catch (error: any) {
    console.error('❌ Error updating category:', error);
    return NextResponse.json({ 
      error: 'Failed to update category',
      details: error?.message 
    }, { status: 500 });
  }
}

// GET - Get all unique categories
export async function GET() {
  try {
    const manuals = await prisma.menuManual.findMany({
      where: { 
        isActive: true, 
        isArchived: false,
        category: { not: null }
      },
      select: { category: true },
      distinct: ['category']
    });

    const categories = manuals
      .map(m => m.category)
      .filter((c): c is string => c !== null && c !== '')
      .sort();

    // Add predefined categories
    const defaultCategories = ['치킨', '사이드', '음료', '소스', '기타'];
    const allCategories = [...new Set([...defaultCategories, ...categories])].sort();

    return NextResponse.json(allCategories);
  } catch (error: any) {
    console.error('❌ Error fetching categories:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch categories',
      details: error?.message 
    }, { status: 500 });
  }
}
