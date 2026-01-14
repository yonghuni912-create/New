
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { items } = body; // items: Array<{ id, openingStock, stockIn, wastage, actualClosingStock }>

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Invalid items data' },
        { status: 400 }
      );
    }

    // 트랜잭션을 사용하여 모든 업데이트를 원자적으로 처리
    const results = await prisma.$transaction(
      items.map((item) => {
        // 총 소모량 자동 계산
        // Logic: 기초 + 입고 - 폐기 - 기말 = 소모량
        // 값이 없는 경우 0으로 처리하여 계산 오류 방지
        const opening = Number(item.openingStock) || 0;
        const stockIn = Number(item.stockIn) || 0;
        const wastage = Number(item.wastage) || 0;
        const closing = Number(item.actualClosingStock) || 0;
        
        const totalUsage = opening + stockIn - wastage - closing;

        return prisma.inventoryItem.update({
          where: { id: item.id },
          data: {
            openingStock: opening, // 사용자가 기초 재고를 수정했을 수도 있으므로 업데이트
            stockIn: stockIn,
            wastage: wastage,
            actualClosingStock: closing,
            totalUsage: totalUsage, // 서버 사이드 자동 계산 결과 저장
          },
        });
      })
    );

    return NextResponse.json({ updatedCount: results.length });
  } catch (error) {
    console.error('Error batch updating inventory items:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory items' },
      { status: 500 }
    );
  }
}
