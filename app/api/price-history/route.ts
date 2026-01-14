import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - Get price history for a template item
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const templateItemId = searchParams.get('templateItemId');
  const templateId = searchParams.get('templateId');
  const ingredientId = searchParams.get('ingredientId');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    let where: any = {};

    if (templateItemId) {
      where.templateItemId = templateItemId;
    } else if (templateId && ingredientId) {
      // Find the template item first
      const templateItem = await prisma.ingredientTemplateItem.findFirst({
        where: { templateId, ingredientId }
      });
      if (templateItem) {
        where.templateItemId = templateItem.id;
      }
    } else if (templateId) {
      // Get all items for this template
      const templateItems = await prisma.ingredientTemplateItem.findMany({
        where: { templateId },
        select: { id: true }
      });
      where.templateItemId = { in: templateItems.map(ti => ti.id) };
    }

    const history = await prisma.priceHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        templateItem: {
          include: {
            ingredient: true,
            template: true
          }
        }
      }
    });

    // Get user names for the history
    const userIds = [...new Set(history.map(h => h.changedBy).filter(Boolean))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true }
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

    const enrichedHistory = history.map(h => ({
      ...h,
      changedByName: userMap[h.changedBy] || h.changedBy,
      priceChange: h.newPrice - h.oldPrice,
      priceChangePercent: h.oldPrice > 0 ? ((h.newPrice - h.oldPrice) / h.oldPrice) * 100 : 0
    }));

    return NextResponse.json({ history: enrichedHistory });
  } catch (error) {
    console.error('Failed to fetch price history:', error);
    return NextResponse.json({ error: 'Failed to fetch price history' }, { status: 500 });
  }
}
