/**
 * commandCenterDb.ts - BBQ Command Center PostgreSQL 연결
 * bbq_command_center에서 적재된 판매 데이터 및 이메일 리포트 조회
 */
import { Pool, PoolClient } from 'pg';

// PostgreSQL 연결 풀 (싱글톤)
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.COMMAND_CENTER_DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('COMMAND_CENTER_DATABASE_URL 환경 변수가 설정되지 않았습니다.');
    }
    
    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } 
        : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    
    pool.on('error', (err) => {
      console.error('PostgreSQL Pool Error:', err);
    });
  }
  
  return pool;
}

/**
 * 쿼리 실행 헬퍼
 */
async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

/**
 * 단일 값 조회
 */
async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
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
        report_date::text, 
        subject, 
        sent_at::text, 
        success,
        total_sales,
        total_orders,
        sales_dod_pct
      FROM email_reports
      ORDER BY report_date DESC, sent_at DESC
      LIMIT $1 OFFSET $2
    `, [pageSize, offset]),
    
    queryOne<{ count: string }>('SELECT COUNT(*) as count FROM email_reports')
  ]);
  
  return {
    reports,
    total: parseInt(countResult?.count || '0', 10)
  };
}

/**
 * 특정 날짜의 리포트 상세 조회
 */
export async function getEmailReportByDate(
  reportDate: string
): Promise<EmailReportDetail | null> {
  return queryOne<EmailReportDetail>(`
    SELECT 
      id,
      report_date::text,
      subject,
      html_content,
      recipients,
      sent_at::text,
      success,
      error_message,
      total_sales,
      total_orders,
      sales_dod_pct
    FROM email_reports
    WHERE report_date = $1
    ORDER BY sent_at DESC
    LIMIT 1
  `, [reportDate]);
}

/**
 * 특정 리포트 ID로 상세 조회
 */
export async function getEmailReportById(
  id: number
): Promise<EmailReportDetail | null> {
  return queryOne<EmailReportDetail>(`
    SELECT 
      id,
      report_date::text,
      subject,
      html_content,
      recipients,
      sent_at::text,
      success,
      error_message,
      total_sales,
      total_orders,
      sales_dod_pct
    FROM email_reports
    WHERE id = $1
  `, [id]);
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
    WHERE report_date = $1
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
    WHERE report_date = $1 AND chart_name = $2
  `, [reportDate, chartName]);
  
  return result?.image_data || null;
}

// ============================================================
// 판매 데이터 관련 쿼리
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
 * 일별 매출 요약 조회
 */
export async function getDailySalesSummary(
  startDate: string,
  endDate: string
): Promise<DailySales[]> {
  return query<DailySales>(`
    SELECT 
      business_date::text,
      restaurant_name,
      COALESCE(SUM(total_amount), 0)::numeric as total_sales,
      COUNT(*)::int as order_count,
      COALESCE(AVG(total_amount), 0)::numeric as avg_ticket
    FROM fact_orders
    WHERE business_date BETWEEN $1 AND $2
      AND voided = false
    GROUP BY business_date, restaurant_name
    ORDER BY business_date DESC, total_sales DESC
  `, [startDate, endDate]);
}

/**
 * 전체 매장 KPI 조회 (특정 날짜 기준)
 */
export async function getSalesKPI(targetDate: string): Promise<SalesKPI | null> {
  return queryOne<SalesKPI>(`
    WITH today AS (
      SELECT COALESCE(SUM(total_amount), 0) as sales
      FROM fact_orders
      WHERE business_date = $1 AND voided = false
    ),
    yesterday AS (
      SELECT COALESCE(SUM(total_amount), 0) as sales
      FROM fact_orders
      WHERE business_date = $1::date - interval '1 day' AND voided = false
    ),
    last_week AS (
      SELECT COALESCE(SUM(total_amount), 0) as sales
      FROM fact_orders
      WHERE business_date = $1::date - interval '7 days' AND voided = false
    ),
    mtd AS (
      SELECT COALESCE(SUM(total_amount), 0) as sales
      FROM fact_orders
      WHERE business_date >= date_trunc('month', $1::date)
        AND business_date <= $1::date
        AND voided = false
    ),
    ytd AS (
      SELECT COALESCE(SUM(total_amount), 0) as sales
      FROM fact_orders
      WHERE business_date >= date_trunc('year', $1::date)
        AND business_date <= $1::date
        AND voided = false
    )
    SELECT 
      today.sales::numeric as today_sales,
      yesterday.sales::numeric as yesterday_sales,
      CASE WHEN yesterday.sales > 0 
        THEN ((today.sales - yesterday.sales) / yesterday.sales * 100)::numeric
        ELSE 0 END as dod_pct,
      last_week.sales::numeric as last_week_sales,
      CASE WHEN last_week.sales > 0 
        THEN ((today.sales - last_week.sales) / last_week.sales * 100)::numeric
        ELSE 0 END as wow_pct,
      mtd.sales::numeric as mtd_sales,
      ytd.sales::numeric as ytd_sales
    FROM today, yesterday, last_week, mtd, ytd
  `, [targetDate]);
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
 * 연결 풀 종료 (앱 종료 시)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
