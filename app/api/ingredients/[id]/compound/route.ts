import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - 혼합 식재료의 하위 아이템 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const compoundItems = await prisma.compoundIngredientItem.findMany({
      where: { compoundIngredientId: params.id },
      include: {
        subIngredient: true
      },
      orderBy: { sortOrder: 'asc' }
    });

    return NextResponse.json(compoundItems);
  } catch (error: any) {
    console.error('Error fetching compound items:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch compound items',
      details: error?.message 
    }, { status: 500 });
  }
}

// POST - 혼합 식재료에 하위 아이템 추가
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { subIngredientId, quantity, unit } = body;

    if (!subIngredientId || !quantity || !unit) {
      return NextResponse.json({ 
        error: 'Missing required fields: subIngredientId, quantity, unit' 
      }, { status: 400 });
    }

    // 순서 계산
    const maxOrder = await prisma.compoundIngredientItem.aggregate({
      where: { compoundIngredientId: params.id },
      _max: { sortOrder: true }
    });

    const compoundItem = await prisma.compoundIngredientItem.create({
      data: {
        compoundIngredientId: params.id,
        subIngredientId,
        quantity,
        unit,
        sortOrder: (maxOrder._max.sortOrder || 0) + 1
      },
      include: {
        subIngredient: true
      }
    });

    // 부모 식재료를 혼합으로 마킹
    await prisma.ingredientMaster.update({
      where: { id: params.id },
      data: { isCompound: true }
    });

    return NextResponse.json(compoundItem, { status: 201 });
  } catch (error: any) {
    console.error('Error creating compound item:', error);
    return NextResponse.json({ 
      error: 'Failed to create compound item',
      details: error?.message 
    }, { status: 500 });
  }
}

// PUT - 혼합 식재료 하위 아이템 전체 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { items } = body; // [{ subIngredientId, quantity, unit }]

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'items must be an array' }, { status: 400 });
    }

    // 기존 아이템 삭제 후 새로 생성
    await prisma.compoundIngredientItem.deleteMany({
      where: { compoundIngredientId: params.id }
    });

    if (items.length > 0) {
      await prisma.compoundIngredientItem.createMany({
        data: items.map((item: { subIngredientId: string; quantity: number; unit: string }, idx: number) => ({
          compoundIngredientId: params.id,
          subIngredientId: item.subIngredientId,
          quantity: item.quantity,
          unit: item.unit,
          sortOrder: idx
        }))
      });

      // 혼합으로 마킹
      await prisma.ingredientMaster.update({
        where: { id: params.id },
        data: { isCompound: true }
      });
    } else {
      // 하위 아이템이 없으면 일반 식재료로 변경
      await prisma.ingredientMaster.update({
        where: { id: params.id },
        data: { isCompound: false }
      });
    }

    const updatedItems = await prisma.compoundIngredientItem.findMany({
      where: { compoundIngredientId: params.id },
      include: { subIngredient: true },
      orderBy: { sortOrder: 'asc' }
    });

    return NextResponse.json(updatedItems);
  } catch (error: any) {
    console.error('Error updating compound items:', error);
    return NextResponse.json({ 
      error: 'Failed to update compound items',
      details: error?.message 
    }, { status: 500 });
  }
}

// DELETE - 특정 하위 아이템 삭제 (query param으로 subId 전달)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const subId = searchParams.get('subId');

    if (subId) {
      // 특정 하위 아이템 삭제
      await prisma.compoundIngredientItem.delete({
        where: {
          compoundIngredientId_subIngredientId: {
            compoundIngredientId: params.id,
            subIngredientId: subId
          }
        }
      });
    } else {
      // 모든 하위 아이템 삭제
      await prisma.compoundIngredientItem.deleteMany({
        where: { compoundIngredientId: params.id }
      });

      // 일반 식재료로 변경
      await prisma.ingredientMaster.update({
        where: { id: params.id },
        data: { isCompound: false }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting compound item:', error);
    return NextResponse.json({ 
      error: 'Failed to delete compound item',
      details: error?.message 
    }, { status: 500 });
  }
}
