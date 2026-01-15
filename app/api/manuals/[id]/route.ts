import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const manual = await prisma.menuManual.findUnique({
      where: { id },
      include: {
        ingredients: { orderBy: [{ sortOrder: 'asc' }], include: { ingredientMaster: true } }
      }
    });
    if (!manual) return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    return NextResponse.json(manual);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json();
    const updateData: any = {};
    if (body.name) updateData.name = body.name;
    if (body.koreanName) updateData.koreanName = body.koreanName;
    if (body.yield) updateData.yield = body.yield;
    if (body.yieldUnit) updateData.yieldUnit = body.yieldUnit;
    if (Object.keys(updateData).length > 0) await prisma.menuManual.update({ where: { id }, data: updateData });
    const manual = await prisma.menuManual.findUnique({ where: { id }, include: { ingredients: true } });
    return NextResponse.json(manual);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    await prisma.menuManual.update({ where: { id }, data: { isActive: false, isArchived: true } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}