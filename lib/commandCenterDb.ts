/**
 * commandCenterDb.ts - BBQ Command Center Turso (libsql) 연결
 * Sales Reports 데이터 조회 (마이그레이션된 이메일 리포트)
 */
import { createClient, Client } from '@libsql/client';

// Turso 클라이언트 (싱글톤)
let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    const url = process.env.COMMAND_CENTER_TURSO_URL;
    const authToken = process.env.COMMAND_CENTER_TURSO_TOKEN;
    
    if (!url || !authToken) {
      throw new Error('COMMAND_CENTER_TURSO_URL 또는 COMMAND_CENTER_TURSO_TOKEN 환경 변수가 설정되지 않았습니다.');
    }
    
    client = createClient({
      url,
      authToken,
    });
  }
  
  return client;
}

/**
 * 쿼리 실행 헬퍼
 */
async function query<T = any>(sql: string, args?: any[]): Promise<T[]> {
  const db = getClient();
  const result = await db.execute({ sql, args: args || [] });
  return result.rows as T[];
}

/**
 * 단일 값 조회
 */
async function queryOne<T = any>(sql: string, args?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, args);
  return rows[0] || null;
}

// ============================================================
// 이메일 리포트 관련 쿼리
// ============================================================

export interface EmailReportSummary {
  id: number;
  report_date: string;
  subject: string;
  sent_at: string;
  success: boolean;
  total_sales: string | null;
  total_orders: number | null;
  sales_dod_pct: string | null;
}

export interface EmailReportDetail extends EmailReportSummary {
  html_content: string;
  recipients: string;
  error_message: string | null;
}

export interface ChartImage {
  chart_name: string;
  image_data: Buffer;
}

/**
 * 이메일 리포트 목록 조회 (페이지네이션)
 */
export async function getEmailReports(
  page: number = 1,
  pageSize: number = 20
): Promise<{ reports: EmailReportSummary[]; total: number }> {
  const offset = (page - 1) * pageSize;
  
  const [reports, countResult] = await Promise.all([
    query<EmailReportSummary>(`
      SELECT 
        id, 
        report_date, 
        subject, 
        sent_at, 
        success,
        total_sales,
        total_orders,
        sales_dod_pct
      FROM email_reports
      ORDER BY report_date DESC, sent_at DESC
      LIMIT ? OFFSET ?
    `, [pageSize, offset]),
    
    queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM email_reports')
  ]);
  
  // success 필드를 boolean으로 변환
  const formattedReports = reports.map(r => ({
    ...r,
    success: r.success === 1 || r.success === true
  }));
  
  return {
    reports: formattedReports,
    total: countResult?.cnt || 0
  };
}

/**
 * 특정 날짜의 리포트 상세 조회
 */
export async function getEmailReportByDate(
  reportDate: string
): Promise<EmailReportDetail | null> {
  const result = await queryOne<any>(`
    SELECT 
      id,
      report_date,
      subject,
      html_content,
      recipients,
      sent_at,
      success,
      error_message,
      total_sales,
      total_orders,
      sales_dod_pct
    FROM email_reports
    WHERE report_date = ?
    ORDER BY sent_at DESC
    LIMIT 1
  `, [reportDate]);
  
  if (!result) return null;
  
  return {
    ...result,
    success: result.success === 1 || result.success === true
  };
}

/**
 * 특정 리포트 ID로 상세 조회
 */
export async function getEmailReportById(
  id: number
): Promise<EmailReportDetail | null> {
  const result = await queryOne<any>(`
    SELECT 
      id,
      report_date,
      subject,
      html_content,
      recipients,
      sent_at,
      success,
      error_message,
      total_sales,
      total_orders,
      sales_dod_pct
    FROM email_reports
    WHERE id = ?
  `, [id]);
  
  if (!result) return null;
  
  return {
    ...result,
    success: result.success === 1 || result.success === true
  };
}

/**
 * 특정 날짜의 차트 이미지 조회
 */
export async function getChartImages(
  reportDate: string
): Promise<ChartImage[]> {
  return query<ChartImage>(`
    SELECT chart_name, image_data
    FROM chart_images
    WHERE report_date = ?
  `, [reportDate]);
}

/**
 * 특정 차트 이미지 조회
 */
export async function getChartImage(
  reportDate: string,
  chartName: string
): Promise<Buffer | null> {
  const result = await queryOne<{ image_data: Buffer }>(`
    SELECT image_data
    FROM chart_images
    WHERE report_date = ? AND chart_name = ?
  `, [reportDate, chartName]);
  
  return result?.image_data || null;
}

// ============================================================
// 판매 데이터 관련 쿼리 (fact_orders - 참고용, Turso에는 없음)
// ============================================================

export interface DailySales {
  business_date: string;
  restaurant_name: string;
  total_sales: number;
  order_count: number;
  avg_ticket: number;
}

export interface SalesKPI {
  today_sales: number;
  yesterday_sales: number;
  dod_pct: number;
  last_week_sales: number;
  wow_pct: number;
  mtd_sales: number;
  ytd_sales: number;
}

/**
 * 일별 매출 요약 조회 (fact_orders 테이블이 있는 경우)
 * Note: 현재 Turso에는 email_reports만 마이그레이션됨
 */
export async function getDailySalesSummary(
  startDate: string,
  endDate: string
): Promise<DailySales[]> {
  // 현재는 빈 배열 반환 (fact_orders가 Turso에 없음)
  return [];
}

/**
 * 전체 매장 KPI 조회 - email_reports의 저장된 데이터 기반
 */
export async function getSalesKPI(targetDate: string): Promise<SalesKPI | null> {
  // 최근 리포트에서 KPI 추출
  const report = await getEmailReportByDate(targetDate);
  
  if (!report) return null;
  
  // 전일/전주 리포트 조회
  const yesterday = new Date(targetDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(targetDate);
  lastWeek.setDate(lastWeek.getDate() - 7);
  
  const yesterdayReport = await getEmailReportByDate(yesterday.toISOString().split('T')[0]);
  const lastWeekReport = await getEmailReportByDate(lastWeek.toISOString().split('T')[0]);
  
  // 매출 파싱 ($1,234 -> 1234)
  const parseSales = (s: string | null): number => {
    if (!s) return 0;
    return parseFloat(s.replace(/[$,]/g, '')) || 0;
  };
  
  const todaySales = parseSales(report.total_sales);
  const yesterdaySales = parseSales(yesterdayReport?.total_sales || null);
  const lastWeekSales = parseSales(lastWeekReport?.total_sales || null);
  
  // DoD, WoW 계산
  const dodPct = yesterdaySales > 0 
    ? ((todaySales - yesterdaySales) / yesterdaySales * 100) 
    : 0;
  const wowPct = lastWeekSales > 0 
    ? ((todaySales - lastWeekSales) / lastWeekSales * 100) 
    : 0;
  
  // MTD 계산 (같은 달의 모든 리포트 합산)
  const monthStart = targetDate.substring(0, 7) + '-01';
  const mtdReports = await query<{ total_sales: string }>(`
    SELECT total_sales FROM email_reports
    WHERE report_date >= ? AND report_date <= ?
  `, [monthStart, targetDate]);
  
  const mtdSales = mtdReports.reduce((sum, r) => sum + parseSales(r.total_sales), 0);
  
  return {
    today_sales: todaySales,
    yesterday_sales: yesterdaySales,
    dod_pct: Math.round(dodPct * 10) / 10,
    last_week_sales: lastWeekSales,
    wow_pct: Math.round(wowPct * 10) / 10,
    mtd_sales: mtdSales,
    ytd_sales: mtdSales, // 간단히 MTD로 대체
  };
}

// ============================================================
// Metabase 임베딩 관련
// ============================================================

/**
 * Metabase 설정 정보 (환경 변수에서 로드)
 */
export function getMetabaseConfig() {
  return {
    url: process.env.METABASE_URL || '',
    secretKey: process.env.METABASE_SECRET_KEY || '',
    dashboardId: parseInt(process.env.METABASE_DASHBOARD_ID || '0', 10),
  };
}

// ============================================================
// 연결 상태 확인
// ============================================================

/**
 * DB 연결 상태 확인
 */
export async function healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message?: string }> {
  try {
    await query('SELECT 1');
    return { status: 'healthy' };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * 연결 종료
 */
export async function closeConnection(): Promise<void> {
  if (client) {
    client.close();
    client = null;
  }
}
