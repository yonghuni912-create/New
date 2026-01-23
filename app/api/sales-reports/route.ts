import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEmailReports, healthCheck } from '@/lib/commandCenterDb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sales-reports
 * 이메일 리포트 목록 조회
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

  try {
    // DB 연결 확인
    const health = await healthCheck();
    if (health.status === 'unhealthy') {
      return NextResponse.json(
        { error: 'Database connection failed', message: health.message },
        { status: 503 }
      );
    }

    const result = await getEmailReports(page, pageSize);
    
    return NextResponse.json({
      reports: result.reports,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize)
      }
    });
  } catch (error) {
    console.error('Sales reports API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
