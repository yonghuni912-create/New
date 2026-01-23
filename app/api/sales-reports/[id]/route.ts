import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEmailReportById, getEmailReportByDate, getChartImages } from '@/lib/commandCenterDb';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/sales-reports/[id]
 * 특정 리포트 상세 조회 (id 또는 날짜)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const includeCharts = searchParams.get('includeCharts') === 'true';

  try {
    let report;
    
    // id가 숫자면 ID로 조회, 아니면 날짜로 조회
    if (/^\d+$/.test(id)) {
      report = await getEmailReportById(parseInt(id, 10));
    } else {
      // 날짜 형식 검증 (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) {
        return NextResponse.json(
          { error: 'Invalid date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }
      report = await getEmailReportByDate(id);
    }

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // 차트 이미지 포함 여부
    let charts: { chart_name: string; image_url: string }[] = [];
    if (includeCharts) {
      const chartImages = await getChartImages(report.report_date);
      charts = chartImages.map(c => ({
        chart_name: c.chart_name,
        // 차트 이미지는 별도 API로 제공
        image_url: `/api/sales-reports/${report.report_date}/charts/${c.chart_name}`
      }));
    }

    return NextResponse.json({
      report,
      charts
    });
  } catch (error) {
    console.error('Sales report detail API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
