import { createClient } from '@libsql/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Turso connection
const client = createClient({
  url: 'libsql://bbqtest-kunikun.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgyNTQ5NDIsImlkIjoiYjg0NDM1NGUtZjE4YS00NWMzLWI1ZDctNDk2NjljOTM3ZDY3IiwicmlkIjoiZWYzYzk2MGItMDk4Mi00ODhiLWJiNjEtMzc2YzJhNzgwYTliIn0.KSdizD28gjbcZiAjX7KOywhPusSQcPcLDd89ovltYNQX9y2tKakH83Dwxv-iR9JnP5mqOWFGZIT5afP3n6obBA'
});

async function seedVancouverTemplate() {
  console.log('📦 Creating Vancouver, CA Price Template...');
  
  const templateId = crypto.randomUUID();
  
  // Create the Vancouver, CA template
  await client.execute({
    sql: `INSERT INTO PriceTemplate (id, name, country, region, currency, description, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    args: [
      templateId,
      'Vancouver, CA',
      'Canada',
      'Vancouver',
      'CAD',
      'Canadian Dollar prices for Vancouver region',
      1
    ]
  });
  
  console.log('✅ Template created with ID:', templateId);
  
  // Read Excel file
  const excelPath = path.join(process.cwd(), '원가파일-20250506 (1).xlsx');
  
  if (!fs.existsSync(excelPath)) {
    console.log('⚠️ Excel file not found at:', excelPath);
    console.log('📝 Will copy items from master with price 0');
    
    // Copy all items from IngredientMaster with price 0
    const ingredients = await client.execute('SELECT id, category, koreanName, englishName FROM IngredientMaster');
    
    console.log(`📋 Found ${ingredients.rows.length} ingredients in master`);
    
    for (const ing of ingredients.rows) {
      const itemId = crypto.randomUUID();
      await client.execute({
        sql: `INSERT INTO PriceTemplateItem (id, priceTemplateId, ingredientMasterId, unitPrice, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        args: [itemId, templateId, ing.id as string, 0]
      });
    }
    
    console.log(`✅ Created ${ingredients.rows.length} price items with price 0`);
    return;
  }
  
  console.log('📖 Reading Excel file:', excelPath);
  
  const workbook = XLSX.readFile(excelPath);
  
  // Find the ingredients sheet (try different possible names)
  const sheetNames = workbook.SheetNames;
  console.log('📑 Available sheets:', sheetNames);
  
  // Try to find the right sheet
  const possibleSheetNames = ['Raw chicken', 'Oil', 'Sauce', 'Powder', 'Dry goods', 'Food', 'Produced', 'Packaging', 'Others'];
  
  let totalCreated = 0;
  
  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    
    if (data.length < 2) continue;
    
    // Find the header row (look for "CAD" column)
    let headerRow = 0;
    let cadColumn = -1;
    let koreanNameColumn = -1;
    let englishNameColumn = -1;
    
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (!row) continue;
      
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').trim();
        if (cell === 'CAD' || cell.includes('CAD')) {
          cadColumn = j;
          headerRow = i;
        }
        if (cell === '품목' || cell === '식재료명' || cell.includes('Korean')) {
          koreanNameColumn = j;
        }
        if (cell === 'Ingredient' || cell.includes('English') || cell.includes('Item')) {
          englishNameColumn = j;
        }
      }
    }
    
    if (cadColumn === -1) {
      console.log(`⏭️ Sheet "${sheetName}" doesn't have CAD column, skipping`);
      continue;
    }
    
    console.log(`\n📄 Processing sheet: ${sheetName}`);
    console.log(`   Header row: ${headerRow}, CAD column: ${cadColumn}`);
    
    // Process data rows
    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;
      
      const koreanName = koreanNameColumn >= 0 ? String(row[koreanNameColumn] || '').trim() : '';
      const englishName = englishNameColumn >= 0 ? String(row[englishNameColumn] || '').trim() : '';
      const cadPrice = parseFloat(String(row[cadColumn] || '0').replace(/[^0-9.]/g, '')) || 0;
      
      if (!koreanName && !englishName) continue;
      
      // Find matching ingredient in master
      const matchResult = await client.execute({
        sql: `SELECT id FROM IngredientMaster WHERE koreanName = ? OR englishName = ?`,
        args: [koreanName, englishName]
      });
      
      if (matchResult.rows.length > 0) {
        const ingredientId = matchResult.rows[0].id as string;
        const itemId = crypto.randomUUID();
        
        // Check if already exists
        const existing = await client.execute({
          sql: `SELECT id FROM PriceTemplateItem WHERE priceTemplateId = ? AND ingredientMasterId = ?`,
          args: [templateId, ingredientId]
        });
        
        if (existing.rows.length === 0) {
          await client.execute({
            sql: `INSERT INTO PriceTemplateItem (id, priceTemplateId, ingredientMasterId, unitPrice, createdAt, updatedAt)
                  VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
            args: [itemId, templateId, ingredientId, cadPrice]
          });
          totalCreated++;
          console.log(`   ✓ ${koreanName || englishName}: $${cadPrice} CAD`);
        }
      }
    }
  }
  
  // For any ingredients without prices, add with 0
  const missingResult = await client.execute({
    sql: `SELECT im.id, im.koreanName 
          FROM IngredientMaster im 
          WHERE im.id NOT IN (
            SELECT ingredientMasterId FROM PriceTemplateItem WHERE priceTemplateId = ?
          )`,
    args: [templateId]
  });
  
  for (const ing of missingResult.rows) {
    const itemId = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO PriceTemplateItem (id, priceTemplateId, ingredientMasterId, unitPrice, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      args: [itemId, templateId, ing.id as string, 0]
    });
    totalCreated++;
  }
  
  console.log(`\n✅ Total items created: ${totalCreated}`);
  console.log('🎉 Vancouver, CA Price Template seeding complete!');
}

seedVancouverTemplate().catch(console.error);
