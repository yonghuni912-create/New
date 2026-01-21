const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
require('dotenv').config({ path: '.env.local' });

// Category mapping (Korean to English)
const categoryMap = {
  '원료육': 'Chicken',
  '오일': 'Oil',
  '파우더': 'Powder',
  '소스': 'Sauce',
  'Dry': 'Dry',
  '야채': 'Vegetable',
  '유제품': 'Dairy',
  '냉동식품': 'Frozen',
  'Prep': 'Prep',
  '부재료': 'Miscellaneous',
  '샐러드': 'Salad',
  '기타': 'Other'
};

function getCategoryFromKorean(koreanCat) {
  if (!koreanCat) return 'Other';
  const cleanCat = String(koreanCat).replace(/\r\n/g, '').replace(/\n/g, '').trim();
  
  // Check for packaging specifically
  if (cleanCat.includes('Packaing') || cleanCat.includes('Packaging')) {
    return 'Packaging';
  }
  
  // Find matching category
  for (const [korean, english] of Object.entries(categoryMap)) {
    if (cleanCat.includes(korean) || cleanCat === korean) {
      return english;
    }
  }
  return 'Other';
}

async function main() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  
  // Get Honduras template ID
  const templateResult = await db.execute({
    sql: "SELECT id FROM PriceTemplate WHERE country = 'Honduras'",
    args: []
  });
  
  if (templateResult.rows.length === 0) {
    console.error('Honduras template not found!');
    return;
  }
  
  const templateId = templateResult.rows[0].id;
  console.log('Using Honduras template:', templateId);
  
  // Read Excel file
  const wb = XLSX.readFile('Excel/Honduras 1st store Food cost - BBQ.xlsx');
  const ws = wb.Sheets['Master'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  // Extract ingredients
  const ingredients = [];
  let currentCategory = '';
  const seenItems = new Set(); // Track duplicates
  
  for (let i = 5; i < data.length; i++) {
    const row = data[i];
    if (!row || (!row[1] && !row[2])) continue;
    
    // Update category if present
    if (row[0] && typeof row[0] === 'string') {
      currentCategory = getCategoryFromKorean(row[0]);
    }
    
    // Skip if no name
    if (!row[1] && !row[2]) continue;
    
    const koreanName = String(row[1] || '').trim();
    const englishName = String(row[2] || '').trim();
    
    // Skip duplicate/test rows
    if (koreanName.includes('시스코') || koreanName.includes('가격') || koreanName.includes('_')) continue;
    
    // Create unique key to avoid duplicates
    const key = `${englishName || koreanName}`.toLowerCase();
    if (seenItems.has(key)) continue;
    seenItems.add(key);
    
    const quantity = parseFloat(row[7]) || 1000;
    const price = parseFloat(row[9]) || 0;
    const usage = parseFloat(row[15]) || 100;
    
    // Validate data
    if (!englishName && !koreanName) continue;
    if (price <= 0 && quantity <= 0) continue;
    
    ingredients.push({
      category: currentCategory,
      koreanName: koreanName,
      englishName: englishName || koreanName,
      quantity: quantity,
      unit: 'g',
      price: price,
      usage: usage
    });
  }
  
  console.log(`Extracted ${ingredients.length} unique ingredients`);
  
  // Count by category
  const byCat = {};
  ingredients.forEach(i => {
    byCat[i.category] = (byCat[i.category] || 0) + 1;
  });
  console.log('\nBy category:');
  Object.entries(byCat).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  
  // Insert into IngredientMaster first, then PriceTemplateItem
  console.log('\nInserting into database...');
  let inserted = 0;
  let errors = 0;
  
  for (const ing of ingredients) {
    try {
      const masterId = `ing_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
      const itemId = `pti_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
      const now = new Date().toISOString();
      
      // 1. Check if ingredient already exists in IngredientMaster by englishName
      const existing = await db.execute({
        sql: "SELECT id FROM IngredientMaster WHERE englishName = ? LIMIT 1",
        args: [ing.englishName]
      });
      
      let ingredientMasterId;
      
      if (existing.rows.length > 0) {
        // Use existing master ingredient
        ingredientMasterId = existing.rows[0].id;
      } else {
        // Create new master ingredient
        await db.execute({
          sql: `INSERT INTO IngredientMaster (id, category, koreanName, englishName, quantity, unit, yieldRate, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            masterId,
            ing.category,
            ing.koreanName,
            ing.englishName,
            ing.quantity,
            ing.unit,
            ing.usage,       // yieldRate as percentage (e.g., 100)
            now,
            now
          ]
        });
        ingredientMasterId = masterId;
      }
      
      // 2. Create PriceTemplateItem linking to the IngredientMaster
      await db.execute({
        sql: `INSERT INTO PriceTemplateItem (
                id, priceTemplateId, ingredientMasterId, unitPrice, packagingUnit, packagingQty, notes,
                createdAt, updatedAt, localEnglishName, localKoreanName, localQuantity, localUnit, localYieldRate
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          itemId,
          templateId,
          ingredientMasterId,  // Link to master
          ing.price,           // unitPrice
          ing.unit,            // packagingUnit (g)
          ing.quantity,        // packagingQty
          null,                // notes
          now,
          now,
          ing.englishName,     // localEnglishName
          ing.koreanName,      // localKoreanName
          ing.quantity,        // localQuantity
          ing.unit,            // localUnit
          ing.usage / 100      // localYieldRate (convert % to decimal)
        ]
      });
      inserted++;
      
      // Small delay to avoid rate limiting
      if (inserted % 20 === 0) {
        console.log(`  Inserted ${inserted}/${ingredients.length}...`);
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err) {
      console.error(`  Error inserting ${ing.englishName}:`, err.message);
      errors++;
    }
  }
  
  console.log(`\n✅ Done! Inserted ${inserted} ingredients, ${errors} errors`);
  
  // Verify
  const countResult = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM PriceTemplateItem WHERE priceTemplateId = ?',
    args: [templateId]
  });
  console.log(`Total items in Honduras template: ${countResult.rows[0].count}`);
}

main().catch(console.error);
