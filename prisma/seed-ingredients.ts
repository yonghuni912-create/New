/**
 * Seed IngredientMaster from Excel file
 * 
 * Excel 파일 경로: 원가파일-20250506 (1).xlsx
 * 시트: Master Price page
 * 컬럼 구조:
 *   B: No
 *   C: 카테고리 (Category)
 *   D: 품목명 (Korean)
 *   E: 상세사항 (Master)
 *   F: NAME (English)
 *   G: 수량/용량/무게 (Quantity)
 *   H: 단위 (Unit)
 *   I: 수율 (Yield)
 *   J: CAD (Price for Canada)
 * 
 * 실행: npx ts-node prisma/seed-ingredients.ts
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

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

async function seedIngredients() {
  const excelPath = path.join(__dirname, '..', '원가파일-20250506 (1).xlsx');
  
  console.log('📂 Reading Excel file:', excelPath);
  
  try {
    const workbook = XLSX.readFile(excelPath);
    const sheetName = 'Master Price page';
    
    if (!workbook.SheetNames.includes(sheetName)) {
      console.error('❌ Sheet not found:', sheetName);
      console.log('Available sheets:', workbook.SheetNames);
      return;
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    console.log(`📊 Found ${jsonData.length} rows in sheet`);
    
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
        yieldRate: typeof yieldRate === 'number' ? yieldRate * 100 : parseFloat(yieldRate) * 100 || 100,
        cadPrice: typeof cadPrice === 'number' ? cadPrice : parseFloat(cadPrice) || null
      });
    }
    
    console.log(`📝 Parsed ${ingredients.length} ingredients`);
    
    // Insert into database
    let created = 0;
    let updated = 0;
    let errors = 0;
    
    for (const ing of ingredients) {
      try {
        // Check if ingredient already exists by koreanName
        const existing = await prisma.ingredientMaster.findFirst({
          where: {
            koreanName: ing.koreanName
          }
        });
        
        if (existing) {
          // Update existing
          await prisma.ingredientMaster.update({
            where: { id: existing.id },
            data: {
              category: ing.category,
              englishName: ing.englishName,
              quantity: ing.quantity,
              unit: ing.unit,
              yieldRate: ing.yieldRate
            }
          });
          updated++;
        } else {
          // Create new
          await prisma.ingredientMaster.create({
            data: {
              category: ing.category,
              koreanName: ing.koreanName,
              englishName: ing.englishName,
              quantity: ing.quantity,
              unit: ing.unit,
              yieldRate: ing.yieldRate
            }
          });
          created++;
        }
      } catch (err: any) {
        console.error(`❌ Error processing ${ing.koreanName}:`, err.message);
        errors++;
      }
    }
    
    console.log('\n✅ Seed completed:');
    console.log(`   - Created: ${created}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Errors: ${errors}`);
    
  } catch (error) {
    console.error('❌ Error reading Excel:', error);
  } finally {
    await prisma.$disconnect();
  }
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
