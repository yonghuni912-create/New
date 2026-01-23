/**
 * PostgreSQL에서 새 Turso DB로 데이터 마이그레이션
 * - email_reports 테이블
 * - chart_images 테이블 (있는 경우)
 */
const { createClient } = require('@libsql/client');
const { Pool } = require('pg');

// PostgreSQL 연결
const pgPool = new Pool({
  connectionString: 'postgresql://postgres:000486@localhost:5433/windsurf_toast'
});

// 새 Turso DB 연결
const turso = createClient({
  url: 'libsql://database-la-vercel-icfg-mrja4qo0a3evj1oadmz7gjh9.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjkxOTI3NTYsImlkIjoiM2ZmZGVjZDYtNmZhYi00MjYxLWFjNmItZjFlOGRkMGI2MzcyIiwicmlkIjoiZmUyMzQ3YmUtYjg3ZS00YzAxLWExN2ItZTc1NGQ3MzQ5MTJkIn0.SMkXyVrNScbEPlX9UHCFMylOPhqAstu4dlW8WaEfqHOzkGwgkFY9G32RnWiPJq0bAhQZO2B6qWYV9Rqv4PZfCQ'
});

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 PostgreSQL → Turso 마이그레이션 시작');
  console.log('='.repeat(60));

  try {
    // 1. Turso에 기존 테이블 삭제 (있으면)
    console.log('\n📦 Step 1: Turso 기존 테이블 정리...');
    try {
      await turso.execute('DROP TABLE IF EXISTS chart_images');
      await turso.execute('DROP TABLE IF EXISTS email_reports');
      console.log('   ✅ 기존 테이블 삭제 완료');
    } catch (e) {
      console.log('   ⚠️ 테이블 삭제 중 오류 (무시):', e.message);
    }

    // 2. Turso에 테이블 생성
    console.log('\n📦 Step 2: Turso에 테이블 생성...');
    
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS email_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_date TEXT NOT NULL,
        subject TEXT NOT NULL,
        html_content TEXT NOT NULL,
        recipients TEXT NOT NULL,
        sent_at TEXT DEFAULT (datetime('now')),
        success INTEGER DEFAULT 1,
        error_message TEXT,
        total_sales TEXT,
        total_orders INTEGER,
        sales_dod_pct TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('   ✅ email_reports 테이블 생성');

    await turso.execute(`
      CREATE INDEX IF NOT EXISTS idx_email_reports_date ON email_reports(report_date)
    `);
    
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS chart_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_date TEXT NOT NULL,
        chart_name TEXT NOT NULL,
        image_data BLOB NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('   ✅ chart_images 테이블 생성');

    await turso.execute(`
      CREATE INDEX IF NOT EXISTS idx_chart_images_date ON chart_images(report_date)
    `);

    // 3. PostgreSQL에서 데이터 읽기
    console.log('\n📦 Step 3: PostgreSQL에서 데이터 읽기...');
    
    const pgClient = await pgPool.connect();
    
    // email_reports 조회
    const reportsResult = await pgClient.query(`
      SELECT id, report_date, subject, html_content, recipients, sent_at, success, 
             error_message, total_sales, total_orders, sales_dod_pct, created_at
      FROM email_reports
      ORDER BY report_date
    `);
    console.log(`   📧 email_reports: ${reportsResult.rows.length}개 레코드`);

    // chart_images 조회 (있는 경우)
    let chartsResult = { rows: [] };
    try {
      chartsResult = await pgClient.query(`
        SELECT id, report_date, chart_name, image_data, created_at
        FROM chart_images
        ORDER BY report_date
      `);
      console.log(`   📊 chart_images: ${chartsResult.rows.length}개 레코드`);
    } catch (e) {
      console.log('   ⚠️ chart_images 테이블 없음 (건너뜀)');
    }

    pgClient.release();

    // 4. Turso에 데이터 삽입
    console.log('\n📦 Step 4: Turso에 데이터 삽입...');
    
    let insertedReports = 0;
    for (const row of reportsResult.rows) {
      try {
        await turso.execute({
          sql: `INSERT INTO email_reports 
                (report_date, subject, html_content, recipients, sent_at, success, 
                 error_message, total_sales, total_orders, sales_dod_pct, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            row.report_date.toISOString().split('T')[0],
            row.subject,
            row.html_content,
            row.recipients,
            row.sent_at?.toISOString() || null,
            row.success ? 1 : 0,
            row.error_message,
            row.total_sales,
            row.total_orders,
            row.sales_dod_pct,
            row.created_at?.toISOString() || null
          ]
        });
        insertedReports++;
      } catch (e) {
        console.log(`   ❌ 리포트 삽입 실패 (${row.report_date}):`, e.message);
      }
    }
    console.log(`   ✅ email_reports: ${insertedReports}개 삽입 완료`);

    let insertedCharts = 0;
    for (const row of chartsResult.rows) {
      try {
        await turso.execute({
          sql: `INSERT INTO chart_images (report_date, chart_name, image_data, created_at)
                VALUES (?, ?, ?, ?)`,
          args: [
            row.report_date.toISOString().split('T')[0],
            row.chart_name,
            row.image_data,
            row.created_at?.toISOString() || null
          ]
        });
        insertedCharts++;
      } catch (e) {
        console.log(`   ❌ 차트 삽입 실패:`, e.message);
      }
    }
    if (chartsResult.rows.length > 0) {
      console.log(`   ✅ chart_images: ${insertedCharts}개 삽입 완료`);
    }

    // 5. 검증
    console.log('\n📦 Step 5: 마이그레이션 검증...');
    const verifyReports = await turso.execute('SELECT COUNT(*) as cnt FROM email_reports');
    const verifyCharts = await turso.execute('SELECT COUNT(*) as cnt FROM chart_images');
    
    console.log(`   📧 email_reports: ${verifyReports.rows[0].cnt}개`);
    console.log(`   📊 chart_images: ${verifyCharts.rows[0].cnt}개`);

    // 샘플 데이터 확인
    const sampleReports = await turso.execute('SELECT report_date, subject, total_sales FROM email_reports ORDER BY report_date DESC LIMIT 5');
    console.log('\n   📋 최근 5개 리포트:');
    sampleReports.rows.forEach(r => {
      console.log(`      ${r.report_date} | ${r.total_sales} | ${r.subject.substring(0, 40)}...`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ 마이그레이션 완료!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
  } finally {
    await pgPool.end();
  }
}

main();
