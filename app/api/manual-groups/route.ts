import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - List all manual groups
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeManuals = searchParams.get('includeManuals') === 'true';
  const includeTemplate = searchParams.get('includeTemplate') === 'true';

  try {
    const groups = await prisma.manualGroup.findMany({
      include: {
        template: includeTemplate
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(groups);
  } catch (error) {
    console.error('Error fetching manual groups:', error);
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
  }
}

// POST - Create a new manual group
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, templateId, currency } = body;

    const group = await prisma.manualGroup.create({
      data: {
        name,
        description,
        templateId,
        currency: currency || 'CAD'
      },
      include: {
        template: true
      }
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error('Error creating manual group:', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}
