/**
 * Seed IngredientMaster to Turso from Excel file
 * 
 * Excel 파일 경로: 원가파일-20250506 (1).xlsx
 * 시트: Master Price page
 * 
 * 실행: npx ts-node prisma/seed-ingredients-turso.ts
 */

import { createClient } from '@libsql/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface ExcelRow {
  no: number;
  category: string;
  koreanName: string;
  masterDetail: string;
  englishName: string;
  quantity: number;
  unit: string;
  yieldRate: number;
  cadPrice: number | null;
}

function getDb() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  
  if (!url || !authToken) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set');
  }
  
  return createClient({ url, authToken });
}

function generateId(): string {
  return 'clseed' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

async function seedIngredients() {
  const db = getDb();
  
  // Try different Excel file paths
  const possiblePaths = [
    path.join(__dirname, '..', '원가파일-20250506 (1).xlsx'),
    path.join(__dirname, '..', '..', '원가파일-20250506 (1).xlsx'),
    'C:\\Users\\kunbb\\OneDrive\\기본\\바탕 화면\\데이터분석 자동화\\Master Data File\\합쳐진파일\\원가파일-20250506 (1).xlsx'
  ];
  
  let excelPath: string | null = null;
  let workbook: XLSX.WorkBook | null = null;
  
  for (const p of possiblePaths) {
    try {
      console.log('📂 Trying path:', p);
      workbook = XLSX.readFile(p);
      excelPath = p;
      console.log('✅ Found Excel file at:', p);
      break;
    } catch (e) {
      continue;
    }
  }
  
  if (!workbook || !excelPath) {
    console.error('❌ Excel file not found');
    return;
  }
  
  console.log('Available sheets:', workbook.SheetNames);
  
  // Try different sheet names
  const possibleSheets = ['Master Price page', 'Master Price', 'Sheet1', workbook.SheetNames[0]];
  let worksheet: XLSX.WorkSheet | null = null;
  let sheetName: string | null = null;
  
  for (const s of possibleSheets) {
    if (workbook.SheetNames.includes(s)) {
      worksheet = workbook.Sheets[s];
      sheetName = s;
      console.log('📊 Using sheet:', s);
      break;
    }
  }
  
  if (!worksheet || !sheetName) {
    console.error('❌ No valid sheet found');
    return;
  }
  
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
  
  console.log(`📊 Found ${jsonData.length} rows in sheet`);
  
  // Log first few rows to understand structure
  console.log('First 5 rows:');
  for (let i = 0; i < Math.min(5, jsonData.length); i++) {
    console.log(`  Row ${i}:`, JSON.stringify((jsonData as any[])[i]?.slice(0, 10)));
  }
  
  // Skip header rows (first 2-3 rows are headers)
  const dataRows = jsonData.slice(3) as any[][];
  
  const ingredients: ExcelRow[] = [];
  
  for (const row of dataRows) {
    // Skip empty rows
    if (!row[1] && !row[2] && !row[3]) continue;
    
    const no = row[1];
    const category = row[2];
    const koreanName = row[3];
    const masterDetail = row[4];
    const englishName = row[5];
    const quantity = row[6];
    const unit = row[7];
    const yieldRate = row[8];
    const cadPrice = row[9];
    
    // Skip if essential fields are missing
    if (!koreanName && !englishName) continue;
    if (category === 'Contents') continue; // Skip section headers
    
    ingredients.push({
      no: typeof no === 'number' ? no : parseInt(no) || 0,
      category: category || 'Others',
      koreanName: koreanName || '',
      masterDetail: masterDetail || '',
      englishName: englishName || koreanName || '',
      quantity: typeof quantity === 'number' ? quantity : parseFloat(quantity) || 0,
      unit: normalizeUnit(unit),
      yieldRate: typeof yieldRate === 'number' 
        ? (yieldRate > 1 ? yieldRate : yieldRate * 100) 
        : parseFloat(yieldRate) > 1 ? parseFloat(yieldRate) : parseFloat(yieldRate) * 100 || 100,
      cadPrice: typeof cadPrice === 'number' ? cadPrice : parseFloat(cadPrice) || null
    });
  }
  
  console.log(`📝 Parsed ${ingredients.length} ingredients`);
  
  // Insert into database
  let created = 0;
  let errors = 0;
  
  for (const ing of ingredients) {
    try {
      // Check if ingredient already exists by koreanName
      const existing = await db.execute({
        sql: 'SELECT id FROM IngredientMaster WHERE koreanName = ?',
        args: [ing.koreanName]
      });
      
      if (existing.rows.length > 0) {
        // Update existing
        await db.execute({
          sql: `UPDATE IngredientMaster 
                SET category = ?, englishName = ?, quantity = ?, unit = ?, yieldRate = ?, updatedAt = ?
                WHERE koreanName = ?`,
          args: [
            ing.category,
            ing.englishName,
            ing.quantity,
            ing.unit,
            ing.yieldRate,
            new Date().toISOString(),
            ing.koreanName
          ]
        });
        console.log(`  Updated: ${ing.koreanName}`);
      } else {
        // Create new
        await db.execute({
          sql: `INSERT INTO IngredientMaster (id, category, koreanName, englishName, quantity, unit, yieldRate, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            generateId(),
            ing.category,
            ing.koreanName,
            ing.englishName,
            ing.quantity,
            ing.unit,
            ing.yieldRate,
            new Date().toISOString(),
            new Date().toISOString()
          ]
        });
        created++;
        console.log(`  Created: ${ing.koreanName}`);
      }
    } catch (err: any) {
      console.error(`❌ Error processing ${ing.koreanName}:`, err.message);
      errors++;
    }
  }
  
  console.log('\n✅ Seed completed:');
  console.log(`   - Created: ${created}`);
  console.log(`   - Errors: ${errors}`);
  
  // Verify count
  const count = await db.execute('SELECT COUNT(*) as count FROM IngredientMaster');
  console.log(`   - Total in DB: ${count.rows[0]?.count}`);
}

function normalizeUnit(unit: string | null): string {
  if (!unit) return 'g';
  
  const u = unit.toString().toLowerCase().trim();
  
  // 소포장 등 특수 케이스
  if (u.includes('소포장') || u.includes('bag')) return 'bag';
  
  // 일반 단위 매핑
  const unitMap: Record<string, string> = {
    'g': 'g',
    'kg': 'kg',
    'ml': 'ml',
    'l': 'L',
    'ea': 'ea',
    'pcs': 'pcs',
    'oz': 'oz',
    'lb': 'lb'
  };
  
  return unitMap[u] || u;
}

// Run the seed
seedIngredients()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
