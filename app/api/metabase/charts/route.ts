import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { executeNativeQuery, testConnection } from '@/lib/metabaseApi';

export const dynamic = 'force-dynamic';

// 매장-지역 매핑
const STORE_REGIONS: Record<string, string> = {
  'Stampede': 'AB', 'Midnapore': 'AB', 'Cochrane': 'AB', 'Westbrook': 'AB',
  'Southland Crossing': 'AB', 'Nolan Hill': 'AB', 'Canmore': 'AB',
  'London Square': 'AB', 'Calgary Trail': 'AB', 'West Edmonton': 'AB',
  'Fort McMurray': 'AB', 'Yorkton': 'AB',
  'Hanin Village': 'BC', 'Poco Place': 'BC', 'Surrey Guildford': 'BC',
  'Main Street': 'BC', 'Yale': 'BC', 'Hastings': 'BC', 'Richmond': 'BC',
  'Granville': 'BC', 'Metrotown': 'BC',
  'Cummer': 'ON', 'Elm': 'ON', 'Ut Spadina': 'ON', 'Yonge Bloor': 'ON',
  'Downtown Markham': 'ON', 'Hurontario Dundas': 'ON', 'Eagles Landing': 'ON',
  'Danforth': 'ON', 'Hwy7 Leslie': 'ON', 'Dorval Crossing': 'ON',
  'Aurora': 'ON', 'Ajax South': 'ON', 'Newmarket': 'ON',
  'North Scarborough': 'ON', 'Oshawa': 'ON', 'London Downtown': 'ON',
  'Don Mills': 'ON', 'Liberty Village': 'ON', 'Stouffville': 'ON',
  'Waterloo Central': 'ON', 'Moncton': 'ON',
};

/**
 * GET /api/metabase/charts
 * 차트 데이터 조회 (필터 적용)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const chartType = searchParams.get('type') || 'daily_sales';
  const startDate = searchParams.get('startDate') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
  const store = searchParams.get('store') || 'all';
  const region = searchParams.get('region') || 'all';

  try {
    // 연결 테스트
    const connection = await testConnection();
    if (!connection.success) {
      return NextResponse.json(
        { error: 'Metabase connection failed', message: connection.message },
        { status: 503 }
      );
    }

    // 데이터베이스 ID (Metabase에서 확인 필요 - 보통 1 또는 2)
    const databaseId = parseInt(process.env.METABASE_DATABASE_ID || '1');

    let data: any[] = [];
    let sql = '';

    // 매장/지역 필터 조건
    let whereClause = `WHERE o.business_date BETWEEN '${startDate}' AND '${endDate}'`;
    if (store !== 'all') {
      whereClause += ` AND r.name = '${store}'`;
    }
    if (region !== 'all') {
      // 지역별 매장 목록
      const regionStores = Object.entries(STORE_REGIONS)
        .filter(([_, r]) => r === region)
        .map(([s, _]) => `'${s}'`)
        .join(', ');
      if (regionStores) {
        whereClause += ` AND r.name IN (${regionStores})`;
      }
    }

    switch (chartType) {
      case 'daily_sales':
        // 일별 매출 추이
        sql = `
          SELECT 
            o.business_date as date,
            SUM(o.total_amount) as total_sales,
            COUNT(DISTINCT o.order_id) as order_count,
            AVG(o.total_amount) as avg_ticket
          FROM fact_orders o
          JOIN dim_restaurants r ON o.restaurant_guid = r.guid
          ${whereClause}
          GROUP BY o.business_date
          ORDER BY o.business_date
        `;
        break;

      case 'store_performance':
        // 매장별 실적
        sql = `
          SELECT 
            r.name as store_name,
            SUM(o.total_amount) as total_sales,
            COUNT(DISTINCT o.order_id) as order_count,
            AVG(o.total_amount) as avg_ticket
          FROM fact_orders o
          JOIN dim_restaurants r ON o.restaurant_guid = r.guid
          ${whereClause}
          GROUP BY r.name
          ORDER BY total_sales DESC
        `;
        break;

      case 'channel_mix':
        // 채널별 비중
        sql = `
          SELECT 
            COALESCE(d.dining_option_name, 'Unknown') as channel,
            SUM(o.total_amount) as total_sales,
            COUNT(DISTINCT o.order_id) as order_count
          FROM fact_orders o
          JOIN dim_restaurants r ON o.restaurant_guid = r.guid
          LEFT JOIN dim_dining_options d ON o.dining_option_guid = d.dining_option_guid
          ${whereClause}
          GROUP BY d.dining_option_name
          ORDER BY total_sales DESC
        `;
        break;

      case 'hourly_pattern':
        // 시간대별 패턴
        sql = `
          SELECT 
            EXTRACT(HOUR FROM o.order_time) as hour,
            SUM(o.total_amount) as total_sales,
            COUNT(DISTINCT o.order_id) as order_count
          FROM fact_orders o
          JOIN dim_restaurants r ON o.restaurant_guid = r.guid
          ${whereClause}
          GROUP BY EXTRACT(HOUR FROM o.order_time)
          ORDER BY hour
        `;
        break;

      case 'regional_summary':
        // 지역별 요약
        sql = `
          SELECT 
            r.name as store_name,
            SUM(o.total_amount) as total_sales,
            COUNT(DISTINCT o.order_id) as order_count
          FROM fact_orders o
          JOIN dim_restaurants r ON o.restaurant_guid = r.guid
          ${whereClause}
          GROUP BY r.name
          ORDER BY r.name
        `;
        // 조회 후 지역 매핑 추가
        break;

      case 'top_items':
        // 베스트 메뉴
        sql = `
          SELECT 
            m.name as item_name,
            SUM(oi.quantity) as quantity_sold,
            SUM(oi.net_price * oi.quantity) as total_revenue
          FROM fact_order_items oi
          JOIN fact_orders o ON oi.order_guid = o.order_guid
          JOIN dim_restaurants r ON o.restaurant_guid = r.guid
          JOIN dim_menu_items m ON oi.menu_item_guid = m.guid
          ${whereClause}
          GROUP BY m.name
          ORDER BY quantity_sold DESC
          LIMIT 10
        `;
        break;

      default:
        return NextResponse.json({ error: 'Invalid chart type' }, { status: 400 });
    }

    try {
      data = await executeNativeQuery(databaseId, sql);
      
      // regional_summary인 경우 지역 매핑 추가
      if (chartType === 'regional_summary') {
        data = data.map((row: any) => ({
          ...row,
          region: STORE_REGIONS[row.store_name] || 'Other',
        }));
        
        // 지역별 집계
        const regionData: Record<string, { total_sales: number; order_count: number }> = {};
        data.forEach((row: any) => {
          if (!regionData[row.region]) {
            regionData[row.region] = { total_sales: 0, order_count: 0 };
          }
          regionData[row.region].total_sales += parseFloat(row.total_sales) || 0;
          regionData[row.region].order_count += parseInt(row.order_count) || 0;
        });
        
        data = Object.entries(regionData).map(([region, values]) => ({
          region,
          region_name: region === 'AB' ? 'Alberta' : region === 'BC' ? 'British Columbia' : region === 'ON' ? 'Ontario' : 'Other',
          ...values,
        }));
      }
    } catch (queryError) {
      console.error('Query execution error:', queryError);
      // 쿼리 실패 시 빈 데이터 반환 (테이블 구조가 다를 수 있음)
      data = [];
    }

    return NextResponse.json({
      success: true,
      chartType,
      filters: { startDate, endDate, store, region },
      data,
      rowCount: data.length,
    });
  } catch (error) {
    console.error('Chart data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
