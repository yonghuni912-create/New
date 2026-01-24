import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  executeNativeQuery, 
  testConnection, 
  getDatabases,
  getDashboards 
} from '@/lib/metabaseApi';

export const dynamic = 'force-dynamic';

/**
 * POST /api/metabase/embed
 * Metabase API로 데이터 조회 (Native SQL 또는 Question)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { queryType, databaseId, sql, questionId, params = {} } = body;

    if (queryType === 'native' && databaseId && sql) {
      // Native SQL 쿼리 실행
      const data = await executeNativeQuery(databaseId, sql, params);
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json(
      { error: 'Invalid request. Provide queryType, databaseId, and sql.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Metabase API error:', error);
    return NextResponse.json(
      { error: 'Failed to execute query', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/metabase/embed
 * Metabase 연결 상태 및 설정 정보 조회
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // API 연결 테스트
    const connectionTest = await testConnection();
    
    let databases: any[] = [];
    let dashboards: any[] = [];
    
    if (connectionTest.success) {
      try {
        databases = await getDatabases();
        dashboards = await getDashboards();
      } catch (e) {
        console.error('Failed to fetch metadata:', e);
      }
    }

    return NextResponse.json({
      configured: connectionTest.success,
      connection: connectionTest,
      databases: databases.map((db: any) => ({ id: db.id, name: db.name })),
      dashboards: dashboards.slice(0, 10).map((d: any) => ({ id: d.id, name: d.name })),
      // 필터 옵션
      availableFilters: {
        stores: [
          { id: 'all', name: 'All Stores' },
          { id: 'Stampede', name: 'Stampede' },
          { id: 'Midnapore', name: 'Midnapore' },
          { id: 'Cochrane', name: 'Cochrane' },
          { id: 'Westbrook', name: 'Westbrook' },
          { id: 'Southland Crossing', name: 'Southland Crossing' },
          { id: 'Nolan Hill', name: 'Nolan Hill' },
          { id: 'Canmore', name: 'Canmore' },
          { id: 'London Square', name: 'London Square' },
          { id: 'Calgary Trail', name: 'Calgary Trail' },
          { id: 'West Edmonton', name: 'West Edmonton' },
          { id: 'Fort McMurray', name: 'Fort McMurray' },
          { id: 'Hanin Village', name: 'Hanin Village' },
          { id: 'Granville', name: 'Granville' },
          { id: 'Richmond', name: 'Richmond' },
          { id: 'Hastings', name: 'Hastings' },
          { id: 'Metrotown', name: 'Metrotown' },
          { id: 'Cummer', name: 'Cummer' },
          { id: 'Elm', name: 'Elm' },
          { id: 'Yonge Bloor', name: 'Yonge Bloor' },
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
  } catch (error) {
    console.error('Metabase config error:', error);
    return NextResponse.json(
      { 
        configured: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
