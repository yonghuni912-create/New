import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAuditLog } from '@/lib/auditLog';
import { hasPermission } from '@/lib/rbac';
import { ApiErrors } from '@/lib/apiResponse';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return ApiErrors.unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId');

  if (!groupId) {
    return ApiErrors.badRequest('Group ID is required');
  }

  try {
    const periods = await prisma.inventoryPeriod.findMany({
      where: { groupId },
      orderBy: { startDate: 'desc' },
      include: {
        _count: {
          select: { items: true }
        }
      }
    });
    return NextResponse.json(periods);
  } catch (error: unknown) {
    console.error('Error fetching inventory periods:', error);
    return ApiErrors.serverError(error);
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return ApiErrors.unauthorized();
  }

  const userRole = (session.user as any)?.role;
  if (!hasPermission(userRole, 'canCreate')) {
    return ApiErrors.forbidden('Create permission required');
  }

  try {
    const body = await request.json();
    const { groupId, startDate, endDate, notes } = body;

    if (!groupId || !startDate || !endDate) {
      return ApiErrors.badRequest('Missing required fields');
    }

    // 1. 해당 그룹의 가장 최근 재고 조사 기간 찾기 (이전 재고 이관용)
    const lastPeriod = await prisma.inventoryPeriod.findFirst({
      where: { groupId },
      orderBy: { endDate: 'desc' },
      include: { items: true },
    });

    // 2. 모든 식재료 마스터 목록 가져오기
    const allIngredients = await prisma.ingredientMaster.findMany();

    // 3. 새로운 기간 생성
    const newPeriod = await prisma.inventoryPeriod.create({
      data: {
        groupId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'ONGOING',
        notes,
      },
    });

    // 4. 재고 항목(InventoryItem) 자동 생성 로직
    const inventoryItemsData = allIngredients.map((ingredient) => {
      // 이전 기간에서 해당 재료의 데이터 찾기
      const lastItem = lastPeriod?.items.find(
        (item) => item.ingredientMasterId === ingredient.id
      );

      // 이전 기간의 기말 재고를 이번 기간의 기초 재고로 설정
      // 이전 기록이 없으면 0으로 시작
      const openingStock = lastItem ? lastItem.actualClosingStock : 0;

      return {
        inventoryPeriodId: newPeriod.id,
        ingredientMasterId: ingredient.id,
        openingStock: openingStock,
        stockIn: 0,
        wastage: 0,
        actualClosingStock: 0, // 사용자가 추후 입력할 값
      };
    });

    // 대량 삽입 (Bulk Insert)
    if (inventoryItemsData.length > 0) {
      await prisma.inventoryItem.createMany({
        data: inventoryItemsData,
      });
    }

    // Audit log
    await createAuditLog({
      userId: (session.user as any).id,
      action: 'MANUAL_CREATE',
      entityType: 'InventoryPeriod',
      entityId: newPeriod.id,
      oldValue: null,
      newValue: { groupId, startDate, endDate, notes, itemCount: inventoryItemsData.length } as any,
    });

    return NextResponse.json(newPeriod);
  } catch (error: unknown) {
    console.error('Error creating inventory period:', error);
    return ApiErrors.serverError(error);
  }
}
