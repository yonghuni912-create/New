import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - Get a single manual group with details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const group = await prisma.manualGroup.findUnique({
      where: { id },
      include: {
        template: {
          include: {
            items: {
              include: { ingredient: true }
            }
          }
        }
      }
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error('Error fetching manual group:', error);
    return NextResponse.json({ error: 'Failed to fetch group' }, { status: 500 });
  }
}

// PUT - Update a manual group (including apply template to all manuals)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { name, description, templateId, currency, applyTemplateToAll } = body;

    // Update group
    const group = await prisma.manualGroup.update({
      where: { id },
      data: {
        name,
        description,
        templateId,
        currency
      }
    });

    // Note: Turso schema doesn't have groupId in MenuManual, so template application logic is disabled

    // Return updated group with details
    const updatedGroup = await prisma.manualGroup.findUnique({
      where: { id },
      include: {
        template: true
      }
    });

    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error('Error updating manual group:', error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

// DELETE - Delete a manual group
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Note: Turso schema doesn't have groupId in MenuManual
    await prisma.manualGroup.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting manual group:', error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
