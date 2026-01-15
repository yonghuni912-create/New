
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 1. 판매량 조회 (GET)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: periodId } = await params;

  try {
    // 해당 기간의 그룹 ID 조회
    const period = await prisma.inventoryPeriod.findUnique({
      where: { id: periodId },
      select: { groupId: true }
    });

    if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });

    // 그룹에 연결된 모든 POS 링크와, 해당 기간에 저장된 판매량을 함께 조회
    const links = await prisma.posMenuLink.findMany({
      where: { groupId: period.groupId },
      include: {
        sales: {
          where: { inventoryPeriodId: periodId },
          select: { quantitySold: true }
        }
      },
      orderBy: { posMenuName: 'asc' }
    });

    // 응답 데이터 가공
    const result = links.map(link => ({
      posMenuLinkId: link.id,
      posMenuName: link.posMenuName,
      quantitySold: link.sales[0]?.quantitySold || 0
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 });
  }
}

// 2. 판매량 저장 및 이론 소모량 계산 (POST)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: periodId } = await params;

  try {
    const body = await request.json();
    const { sales } = body; // Array<{ posMenuLinkId, quantitySold }>

    // 2-1. 판매량 저장 (Transaction)
    await prisma.$transaction(
      sales.map((item: any) => 
        prisma.periodSales.upsert({
          where: {
            inventoryPeriodId_posMenuLinkId: {
              inventoryPeriodId: periodId,
              posMenuLinkId: item.posMenuLinkId
            }
          },
          update: { quantitySold: Number(item.quantitySold) },
          create: {
            inventoryPeriodId: periodId,
            posMenuLinkId: item.posMenuLinkId,
            quantitySold: Number(item.quantitySold)
          }
        })
      )
    );

    // 2-2. 이론 소모량 계산 로직 시작
    
    // A. 해당 기간의 모든 판매 기록 조회 (+ 레시피 정보 포함)
    const allSales = await prisma.periodSales.findMany({
      where: { inventoryPeriodId: periodId },
      include: {
        posLink: {
          include: {
            manual: {
              include: {
                ingredients: true // 레시피 재료 목록
              }
            }
          }
        }
      }
    });

    // B. 재료별 이론 소모량 집계 (Map 사용)
    const theoreticalMap = new Map<string, number>(); // ingredientId -> totalUsage

    for (const sale of allSales) {
      const qty = sale.quantitySold;
      if (qty <= 0) continue;

      const ingredients = sale.posLink.manual.ingredients;
      for (const ing of ingredients) {
        // 매뉴얼 재료가 마스터 식재료와 연결되어 있을 때만 계산 가능
        if (ing.ingredientId) {
          const currentTotal = theoreticalMap.get(ing.ingredientId) || 0;
          // 공식: 판매량 * 레시피 사용량
          theoreticalMap.set(ing.ingredientId, currentTotal + (qty * ing.quantity));
        }
      }
    }

    // C. DB 업데이트: InventoryItem 테이블에 결과 반영
    // 모든 재고 항목을 조회하고, 계산된 값이 있으면 업데이트, 없으면 0으로 초기화
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { inventoryPeriodId: periodId }
    });

    await prisma.$transaction(
      inventoryItems.map(item => {
        const theoUsage = theoreticalMap.get(item.ingredientMasterId) || 0;
        
        // 차이(Variance) = 실제 소모량(totalUsage) - 이론 소모량(theoreticalUsage)
        // totalUsage가 null이면 0으로 취급
        const actualUsage = item.totalUsage || 0;
        const variance = actualUsage - theoUsage;

        return prisma.inventoryItem.update({
          where: { id: item.id },
          data: {
            theoreticalUsage: theoUsage,
            variance: variance
          }
        });
      })
    );

    return NextResponse.json({ success: true, message: 'Calculated successfully' });

  } catch (error) {
    console.error('Error saving sales & calculating:', error);
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
  }
}
