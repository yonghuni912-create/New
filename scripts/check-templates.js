const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function main() {
  // 1. 모든 PriceTemplate
  console.log('=== All PriceTemplates ===');
  const templates = await db.execute('SELECT id, name, country, currency, isActive FROM PriceTemplate');
  console.log('Total templates:', templates.rows.length);
  templates.rows.forEach(t => console.log(t.id, '|', t.name, '|', t.country, '|', t.currency, '| isActive:', t.isActive));
  
  // 2. 매뉴얼 분포
  console.log('\n=== Manual priceTemplateId distribution ===');
  const distribution = await db.execute('SELECT priceTemplateId, COUNT(*) as cnt FROM MenuManual GROUP BY priceTemplateId ORDER BY cnt DESC');
  distribution.rows.forEach(r => console.log('priceTemplateId:', r.priceTemplateId || 'NULL', '| count:', r.cnt));
  
  // 3. Honduras 템플릿
  console.log('\n=== Honduras search ===');
  const hondurasTemplates = await db.execute("SELECT * FROM PriceTemplate WHERE LOWER(name) LIKE '%hondur%' OR LOWER(country) LIKE '%hondur%'");
  console.log('Honduras templates found:', hondurasTemplates.rows.length);
  hondurasTemplates.rows.forEach(t => console.log(t));
  
  // 4. Vancouver 템플릿
  console.log('\n=== Vancouver search ===');
  const vancouverTemplates = await db.execute("SELECT * FROM PriceTemplate WHERE LOWER(name) LIKE '%vancouver%'");
  console.log('Vancouver templates found:', vancouverTemplates.rows.length);
  vancouverTemplates.rows.forEach(t => console.log(t));
  
  // 5. PriceTemplateItem 분포 확인
  console.log('\n=== PriceTemplateItem distribution ===');
  const itemDistribution = await db.execute('SELECT priceTemplateId, COUNT(*) as cnt FROM PriceTemplateItem GROUP BY priceTemplateId ORDER BY cnt DESC');
  itemDistribution.rows.forEach(r => {
    const template = templates.rows.find(t => t.id === r.priceTemplateId);
    console.log('priceTemplateId:', r.priceTemplateId, '| name:', template?.name || 'UNKNOWN', '| items:', r.cnt);
  });
  
  // 6. Honduras 템플릿의 PriceTemplateItem 확인
  if (hondurasTemplates.rows.length > 0) {
    const hondurasId = hondurasTemplates.rows[0].id;
    console.log('\n=== PriceTemplateItems for Honduras (' + hondurasId + ') ===');
    const items = await db.execute({
      sql: 'SELECT COUNT(*) as cnt FROM PriceTemplateItem WHERE priceTemplateId = ?',
      args: [hondurasId]
    });
    console.log('Item count:', items.rows[0].cnt);
    
    // 샘플 아이템
    const sampleItems = await db.execute({
      sql: `SELECT pti.id, pti.unitPrice, im.koreanName, im.englishName 
            FROM PriceTemplateItem pti 
            JOIN IngredientMaster im ON pti.ingredientMasterId = im.id 
            WHERE pti.priceTemplateId = ? LIMIT 5`,
      args: [hondurasId]
    });
    console.log('Sample items:');
    sampleItems.rows.forEach(i => console.log('  -', i.koreanName, '/', i.englishName, '| price:', i.unitPrice));
  }
  
  // 7. Vancouver 템플릿의 PriceTemplateItem 확인
  if (vancouverTemplates.rows.length > 0) {
    const vancouverId = vancouverTemplates.rows[0].id;
    console.log('\n=== PriceTemplateItems for Vancouver (' + vancouverId + ') ===');
    const items = await db.execute({
      sql: 'SELECT COUNT(*) as cnt FROM PriceTemplateItem WHERE priceTemplateId = ?',
      args: [vancouverId]
    });
    console.log('Item count:', items.rows[0].cnt);
    
    // 샘플 아이템
    const sampleItems = await db.execute({
      sql: `SELECT pti.id, pti.unitPrice, im.koreanName, im.englishName 
            FROM PriceTemplateItem pti 
            JOIN IngredientMaster im ON pti.ingredientMasterId = im.id 
            WHERE pti.priceTemplateId = ? LIMIT 5`,
      args: [vancouverId]
    });
    console.log('Sample items:');
    sampleItems.rows.forEach(i => console.log('  -', i.koreanName, '/', i.englishName, '| price:', i.unitPrice));
  }
}

main().catch(console.error);
