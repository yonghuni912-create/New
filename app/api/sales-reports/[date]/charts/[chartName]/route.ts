import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getChartImage } from '@/lib/commandCenterDb';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ date: string; chartName: string }>;
}

/**
 * GET /api/sales-reports/[date]/charts/[chartName]
 * 특정 차트 이미지 조회
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { date, chartName } = await params;

  // 날짜 형식 검증
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD' },
      { status: 400 }
    );
  }

  try {
    const imageData = await getChartImage(date, chartName);

    if (!imageData) {
      return NextResponse.json(
        { error: 'Chart not found' },
        { status: 404 }
      );
    }

    // Buffer를 Uint8Array로 변환하여 응답
    return new NextResponse(new Uint8Array(imageData), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400', // 24시간 캐시
      }
    });
  } catch (error) {
    console.error('Chart image API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart image' },
      { status: 500 }
    );
  }
}
