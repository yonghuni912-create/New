import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSalesKPI, getDailySalesSummary, healthCheck } from '@/lib/commandCenterDb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics
 * KPI 및 매출 데이터 조회
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'kpi';
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const startDate = searchParams.get('startDate') || date;
  const endDate = searchParams.get('endDate') || date;

  try {
    // DB 연결 확인
    const health = await healthCheck();
    if (health.status === 'unhealthy') {
      return NextResponse.json(
        { error: 'Database connection failed', message: health.message },
        { status: 503 }
      );
    }

    if (type === 'kpi') {
      const [kpi, salesData] = await Promise.all([
        getSalesKPI(date),
        getDailySalesSummary(date, date)
      ]);

      return NextResponse.json({
        kpi: kpi || {
          today_sales: 0,
          yesterday_sales: 0,
          dod_pct: 0,
          last_week_sales: 0,
          wow_pct: 0,
          mtd_sales: 0,
          ytd_sales: 0,
        },
        salesData,
        date
      });
    }

    if (type === 'sales') {
      const salesData = await getDailySalesSummary(startDate, endDate);
      return NextResponse.json({
        salesData,
        startDate,
        endDate
      });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
