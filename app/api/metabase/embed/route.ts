import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

/**
 * POST /api/metabase/embed
 * Metabase Interactive Embedding을 위한 JWT 토큰 생성
 * 
 * 요청 본문:
 * {
 *   "resourceType": "dashboard" | "question",
 *   "resourceId": number,
 *   "params": { [key: string]: any }  // 필터 파라미터
 * }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const metabaseSecretKey = process.env.METABASE_SECRET_KEY;
  const metabaseSiteUrl = process.env.METABASE_URL;

  if (!metabaseSecretKey || !metabaseSiteUrl) {
    return NextResponse.json(
      { 
        error: 'Metabase not configured',
        message: 'METABASE_SECRET_KEY and METABASE_URL must be set' 
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { resourceType = 'dashboard', resourceId, params = {} } = body;

    if (!resourceId) {
      return NextResponse.json(
        { error: 'resourceId is required' },
        { status: 400 }
      );
    }

    // JWT 페이로드 구성
    const payload = {
      resource: { [resourceType]: resourceId },
      params: params,
      exp: Math.round(Date.now() / 1000) + (10 * 60), // 10분 만료
    };

    // JWT 서명
    const token = jwt.sign(payload, metabaseSecretKey);

    // 임베드 URL 생성
    const iframeUrl = `${metabaseSiteUrl}/embed/${resourceType}/${token}#bordered=false&titled=false`;

    return NextResponse.json({
      iframeUrl,
      expiresIn: 600, // 10분
      resourceType,
      resourceId,
      params,
    });
  } catch (error) {
    console.error('Metabase embed token error:', error);
    return NextResponse.json(
      { error: 'Failed to generate embed token', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/metabase/embed
 * 사용 가능한 대시보드/질문 목록 조회 (간단한 설정 정보)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const metabaseSiteUrl = process.env.METABASE_URL;
  const metabaseSecretKey = process.env.METABASE_SECRET_KEY;
  const defaultDashboardId = process.env.METABASE_DASHBOARD_ID;

  return NextResponse.json({
    configured: !!(metabaseSiteUrl && metabaseSecretKey),
    siteUrl: metabaseSiteUrl ? metabaseSiteUrl.replace(/^https?:\/\//, '***://') : null,
    defaultDashboardId: defaultDashboardId || null,
    // 필터 옵션 (하드코딩 또는 DB에서 조회)
    availableFilters: {
      stores: [
        { id: 'all', name: 'All Stores' },
        { id: 'stampede', name: 'Stampede' },
        { id: 'midnapore', name: 'Midnapore' },
        { id: 'cochrane', name: 'Cochrane' },
        { id: 'westbrook', name: 'Westbrook' },
        { id: 'hanin_village', name: 'Hanin Village' },
        { id: 'granville', name: 'Granville' },
        { id: 'richmond', name: 'Richmond' },
        { id: 'cummer', name: 'Cummer' },
        { id: 'elm', name: 'Elm' },
      ],
      regions: [
        { id: 'all', name: 'All Regions' },
        { id: 'AB', name: 'Alberta' },
        { id: 'BC', name: 'British Columbia' },
        { id: 'ON', name: 'Ontario' },
      ],
      dateRanges: [
        { id: 'today', name: 'Today' },
        { id: 'yesterday', name: 'Yesterday' },
        { id: 'last7days', name: 'Last 7 Days' },
        { id: 'last30days', name: 'Last 30 Days' },
        { id: 'thisMonth', name: 'This Month' },
        { id: 'lastMonth', name: 'Last Month' },
        { id: 'custom', name: 'Custom Range' },
      ],
    },
  });
}
