import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
}

// Generate unique ID
function generateId() {
  return `cm${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
}

interface ParsedManual {
  name: string;
  koreanName: string;
  sellingPrice?: number;
  shelfLife?: string;
  ingredients: Array<{
    name: string;
    koreanName?: string;
    quantity: number;
    unit: string;
    purchase?: string;
  }>;
  cookingMethod?: Array<{
    process: string;
    manual: string;
    translatedManual?: string;
  }>;
  hasLinkingIssue: boolean;
  issueDetails?: string[];
}

// POST - Upload and parse Excel file with multiple manuals
export async function POST(request: NextRequest) {
  console.log('📤 Manual upload API called');
  
  // Skip auth for now - allow all uploads
  // const session = await getServerSession(authOptions);
  // if (!session) {
  //   console.log('❌ Unauthorized - no session');
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  try {
    const contentType = request.headers.get('content-type') || '';
    console.log('📋 Content-Type:', contentType);
    
    // Handle direct import mode (JSON body with confirmed manuals)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      if (body.importMode === 'import-direct' && body.manuals) {
        return handleDirectImport(body.manuals);
      }
    }
    
    // Handle file upload mode
    console.log('📁 Parsing form data...');
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const importMode = formData.get('importMode') as string || 'preview'; // 'preview' | 'import'

    if (!file) {
      console.log('❌ No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('📄 File received:', file.name, 'Size:', file.size, 'bytes');
    
    const buffer = await file.arrayBuffer();
    console.log('📦 Buffer size:', buffer.byteLength);
    
    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: 'array' });
      console.log('📊 Excel sheets:', workbook.SheetNames.length, 'sheets');
    } catch (xlsxError: any) {
      console.error('❌ XLSX parse error:', xlsxError?.message);
      return NextResponse.json({ 
        error: 'Excel 파일을 읽을 수 없습니다', 
        details: xlsxError?.message 
      }, { status: 400 });
    }

    const parsedManuals: ParsedManual[] = [];
    const manualsWithIssues: ParsedManual[] = [];
    const parseErrors: string[] = [];

    // Process each sheet as a separate manual
    for (const sheetName of workbook.SheetNames) {
      // Skip sheets that don't look like manual sheets
      if (sheetName.toLowerCase().includes('summary') || 
          sheetName.toLowerCase().includes('목차') ||
          sheetName.toLowerCase().includes('index')) {
        continue;
      }

      try {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        const parsed = parseManualSheet(sheetName, jsonData);
        if (parsed) {
          if (parsed.hasLinkingIssue) {
            manualsWithIssues.push(parsed);
          } else {
            parsedManuals.push(parsed);
          }
        }
      } catch (sheetError: any) {
        console.error(`❌ Error parsing sheet "${sheetName}":`, sheetError?.message);
        parseErrors.push(`${sheetName}: ${sheetError?.message}`);
      }
    }

    console.log(`✅ Parsed ${parsedManuals.length} manuals, ${manualsWithIssues.length} with issues, ${parseErrors.length} errors`);

    // If preview mode, just return the parsed data
    if (importMode === 'preview') {
      // Combine all manuals for individual preview
      const allManuals = [...parsedManuals, ...manualsWithIssues];
      
      return NextResponse.json({
        success: true,
        totalSheets: workbook.SheetNames.length,
        parsedCount: parsedManuals.length,
        issuesCount: manualsWithIssues.length,
        parseErrors: parseErrors.length > 0 ? parseErrors : undefined,
        manuals: parsedManuals,
        manualsWithIssues,
        allManuals // For individual preview navigation
      });
    }

    // Import mode - create manuals in database using Turso
    const db = getDb();
    const createdManuals = [];
    
    for (const manual of parsedManuals) {
      const manualId = generateId();
      const now = new Date().toISOString();
      
      // Create manual
      await db.execute({
        sql: `INSERT INTO MenuManual (id, name, koreanName, sellingPrice, shelfLife, cookingMethod, isMaster, isActive, isArchived, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, ?, ?)`,
        args: [
          manualId,
          manual.name,
          manual.koreanName,
          manual.sellingPrice || null,
          manual.shelfLife || null,
          manual.cookingMethod ? JSON.stringify(manual.cookingMethod) : null,
          now,
          now
        ],
      });
      
      // Create ingredients
      for (let idx = 0; idx < manual.ingredients.length; idx++) {
        const ing = manual.ingredients[idx];
        const ingId = generateId();
        await db.execute({
          sql: `INSERT INTO ManualIngredient (id, manualId, name, koreanName, quantity, unit, sortOrder, notes, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            ingId,
            manualId,
            ing.name,
            ing.koreanName || ing.name,
            ing.quantity || 0,
            ing.unit || 'g',
            idx,
            ing.purchase || null,
            now,
            now
          ],
        });
      }
      
      createdManuals.push({ id: manualId, name: manual.name });
    }

    console.log(`✅ Created ${createdManuals.length} manuals via Turso`);

    return NextResponse.json({
      success: true,
      importedCount: createdManuals.length,
      issuesCount: manualsWithIssues.length,
      manualsWithIssues: manualsWithIssues.map(m => ({
        name: m.name,
        issues: m.issueDetails
      }))
    });

  } catch (error: any) {
    console.error('❌ Excel upload error:', error);
    return NextResponse.json({ 
      error: 'Failed to process Excel file', 
      details: error?.message 
    }, { status: 500 });
  }
}

// Parse a single sheet as a manual - BBQ Chicken Format (키워드 기반 상대 위치 파싱)
function parseManualSheet(sheetName: string, data: any[][]): ParsedManual | null {
  if (data.length < 5) return null;

  // Skip non-menu sheets
  const sheetLower = sheetName.toLowerCase();
  if (sheetLower.includes('kitchen manual') || 
      sheetLower.includes('contents') || 
      sheetLower.includes('목차') ||
      sheetLower.includes('index') ||
      sheetLower.includes('summary') ||
      sheetLower.includes('recipe')) {
    return null;
  }

  let name = sheetName; // Default to sheet name
  let koreanName = '';
  let sellingPrice: number | undefined;
  let shelfLife: string | undefined;
  const ingredients: ParsedManual['ingredients'] = [];
  const cookingMethod: ParsedManual['cookingMethod'] = [];
  const issueDetails: string[] = [];

  // Helper function to find cell by keyword
  const findCellByKeyword = (keyword: string, caseSensitive = false): { row: number, col: number } | null => {
    for (let r = 0; r < data.length; r++) {
      const row = data[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cellValue = String(row[c] || '');
        const searchValue = caseSensitive ? cellValue : cellValue.toLowerCase();
        const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();
        if (searchValue.includes(searchKeyword)) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  };

  // Helper to get cell value at position
  const getCellValue = (row: number, col: number): string => {
    if (row < 0 || row >= data.length) return '';
    const rowData = data[row] || [];
    if (col < 0 || col >= rowData.length) return '';
    return String(rowData[col] || '').trim();
  };

  // 1. Find "Name" keyword and get menu name from adjacent cell
  const nameCell = findCellByKeyword('Name');
  if (nameCell) {
    // Name value is to the right of "Name" label
    const nameValue = getCellValue(nameCell.row, nameCell.col + 1);
    if (nameValue) {
      name = nameValue;
    }
  }

  // 2. Find Korean name (한글명)
  const koreanCell = findCellByKeyword('한글') || findCellByKeyword('korean');
  if (koreanCell) {
    const kValue = getCellValue(koreanCell.row, koreanCell.col + 1);
    if (kValue) koreanName = kValue;
  }
  if (!koreanName) koreanName = name;

  // 3. Find price
  const priceCell = findCellByKeyword('price') || findCellByKeyword('판매가');
  if (priceCell) {
    const priceVal = parseFloat(getCellValue(priceCell.row, priceCell.col + 1).replace(/[^0-9.]/g, ''));
    if (!isNaN(priceVal)) sellingPrice = priceVal;
  }

  // 4. Find Ingredients section by looking for "Ingredients Composition" or "NO | Ingredients | Weight"
  const ingredientHeaderCell = findCellByKeyword('Ingredients Composition') || findCellByKeyword('Ingredients');
  let ingredientStartRow = -1;
  let colNo = 1, colName = 2, colWeight = 4, colUnit = 5, colPurchase = 6;

  if (ingredientHeaderCell) {
    // Look for the actual column headers (NO, Ingredients, Weight, Unit, etc.) in nearby rows
    for (let r = ingredientHeaderCell.row; r < Math.min(ingredientHeaderCell.row + 3, data.length); r++) {
      const row = data[r] || [];
      const rowText = row.map(c => String(c || '').toLowerCase()).join(' ');
      
      // If this row contains "no" and "weight", it's the header row
      if (rowText.includes('no') && (rowText.includes('weight') || rowText.includes('qty'))) {
        // Find column positions dynamically
        for (let c = 0; c < row.length; c++) {
          const cellText = String(row[c] || '').toLowerCase().trim();
          if (cellText === 'no') colNo = c;
          else if (cellText.includes('ingredient') && !cellText.includes('composition')) colName = c;
          else if (cellText.includes('weight') || cellText === 'qty') colWeight = c;
          else if (cellText === 'unit') colUnit = c;
          else if (cellText.includes('purchase')) colPurchase = c;
        }
        ingredientStartRow = r + 1;
        break;
      }
    }
  }

  // 5. Parse ingredients from the found start row
  if (ingredientStartRow > 0) {
    for (let i = ingredientStartRow; i < data.length && i < ingredientStartRow + 50; i++) {
      const row = data[i] || [];
      
      // Stop if we hit cooking method section or empty section
      const firstCellText = String(row[0] || '').toLowerCase();
      if (firstCellText.includes('cooking') || firstCellText.includes('method') || firstCellText.includes('process')) {
        break;
      }
      
      // Get ingredient name - check the identified column
      const ingredientName = String(row[colName] || row[2] || '').trim();
      
      // Skip empty, total, or note rows
      if (!ingredientName || 
          ingredientName.toLowerCase().includes('total') || 
          ingredientName.toLowerCase().includes('합계') ||
          ingredientName.startsWith('*') ||
          ingredientName.toLowerCase().includes('기준')) {
        continue;
      }
      
      // Extract weight
      let weight = 0;
      const weightVal = row[colWeight] ?? row[4];
      if (weightVal !== undefined && weightVal !== null) {
        weight = parseFloat(String(weightVal).replace(/[^0-9.]/g, '')) || 0;
      }
      
      // Extract unit
      let unit = 'g';
      const unitVal = row[colUnit] ?? row[5];
      if (unitVal) {
        unit = String(unitVal).trim().toLowerCase() || 'g';
      }
      
      // Purchase type
      const purchaseVal = row[colPurchase] ?? row[6];
      const purchase = purchaseVal ? String(purchaseVal).trim() : 'Local';

      ingredients.push({
        name: ingredientName,
        koreanName: ingredientName,
        quantity: weight,
        unit: unit,
        purchase: purchase
      });
    }
  }

  // 6. Find COOKING METHOD section by keyword
  const cookingCell = findCellByKeyword('COOKING METHOD');
  let cookingStartRow = -1;
  let manualCol = 3; // Default: D column (index 3)

  if (cookingCell) {
    // Look for "PROCESS" and "MANUAL" headers to find the correct columns
    for (let r = cookingCell.row; r < Math.min(cookingCell.row + 3, data.length); r++) {
      const row = data[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cellText = String(row[c] || '').toUpperCase().trim();
        if (cellText === 'MANUAL') {
          manualCol = c;
          cookingStartRow = r + 1;
          break;
        }
      }
      if (cookingStartRow > 0) break;
    }
    
    // If we didn't find MANUAL header, just start after COOKING METHOD
    if (cookingStartRow < 0) {
      cookingStartRow = cookingCell.row + 2;
    }
  }

  // 7. Parse cooking method steps
  if (cookingStartRow > 0) {
    const manualSteps: string[] = [];
    
    for (let i = cookingStartRow; i < data.length && i < cookingStartRow + 30; i++) {
      const row = data[i] || [];
      
      // Manual text is in the identified column
      const manualText = String(row[manualCol] || row[3] || row[2] || '').trim();
      
      // Skip BBQ branding or empty
      if (!manualText || manualText.toLowerCase().includes('bbq canada') || manualText.toLowerCase().includes('bbq korea')) {
        continue;
      }
      
      if (manualText.startsWith('▶') || manualText.startsWith('•') || manualText.startsWith('-')) {
        manualSteps.push(manualText.replace(/^[▶•-]\s*/, '').trim());
      } else if (manualSteps.length > 0 && manualText.length > 2) {
        // Continuation of previous step
        manualSteps[manualSteps.length - 1] += ' ' + manualText.trim();
      }
    }
    
    if (manualSteps.length > 0) {
      cookingMethod.push({
        process: 'Cooking Instructions',
        manual: manualSteps.join('\n'),
        translatedManual: ''
      });
    }
  }

  // Check for issues
  if (ingredients.length === 0) {
    issueDetails.push('식재료 목록을 찾을 수 없습니다');
  }
  issueDetails.push('가격 템플릿 미지정 - 수동 설정 필요');

  console.log(`📋 Parsed: ${name} - ${ingredients.length} ingredients, ${cookingMethod.length > 0 ? 'has cooking method' : 'no cooking method'}`);

  return {
    name,
    koreanName,
    sellingPrice,
    shelfLife,
    ingredients,
    cookingMethod: cookingMethod.length > 0 ? cookingMethod : undefined,
    hasLinkingIssue: ingredients.length === 0, // Only mark as issue if no ingredients
    issueDetails
  };
}

// Handle direct import from confirmed preview data
// Auto-link ingredients to master ingredients using fuzzy matching
async function autoLinkIngredients(db: ReturnType<typeof getDb>, ingredientNames: string[]): Promise<Map<string, { id: string; similarity: number }>> {
  const linkMap = new Map<string, { id: string; similarity: number }>();
  
  if (ingredientNames.length === 0) return linkMap;
  
  try {
    // Fetch all master ingredients
    const mastersResult = await db.execute({
      sql: `SELECT id, englishName, koreanName FROM IngredientMaster`,
      args: [],
    });
    
    const masters = mastersResult.rows;
    
    // Normalize function
    const normalize = (name: string): string => {
      return (name || '')
        .toLowerCase()
        .replace(/[()（）\[\]【】]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[├└│─\s]+/, '')
        .replace(/^l\s+/i, '')
        .trim();
    };
    
    // Simple Levenshtein distance
    const levenshtein = (a: string, b: string): number => {
      const matrix: number[][] = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          matrix[i][j] = b[i-1] === a[j-1]
            ? matrix[i-1][j-1]
            : Math.min(matrix[i-1][j-1] + 1, matrix[i][j-1] + 1, matrix[i-1][j] + 1);
        }
      }
      return matrix[b.length][a.length];
    };
    
    const similarity = (s1: string, s2: string): number => {
      const n1 = normalize(s1);
      const n2 = normalize(s2);
      if (n1 === n2) return 1;
      if (n1.includes(n2) || n2.includes(n1)) return 0.9;
      const maxLen = Math.max(n1.length, n2.length);
      if (maxLen === 0) return 1;
      return 1 - levenshtein(n1, n2) / maxLen;
    };
    
    // Match each ingredient name
    for (const inputName of ingredientNames) {
      if (!inputName) continue;
      
      let bestMatch: { id: string; similarity: number } | null = null;
      
      for (const master of masters) {
        const engSim = similarity(inputName, master.englishName as string || '');
        const korSim = similarity(inputName, master.koreanName as string || '');
        const maxSim = Math.max(engSim, korSim);
        
        if (maxSim >= 0.6 && (!bestMatch || maxSim > bestMatch.similarity)) {
          bestMatch = { id: master.id as string, similarity: maxSim };
        }
      }
      
      if (bestMatch) {
        linkMap.set(inputName, bestMatch);
      }
    }
    
    console.log(`🔗 Auto-linked ${linkMap.size}/${ingredientNames.length} ingredients`);
  } catch (error) {
    console.error('⚠️ Auto-link failed:', error);
  }
  
  return linkMap;
}

async function handleDirectImport(manuals: ParsedManual[]) {
  console.log('📥 handleDirectImport called with', manuals.length, 'manuals');
  
  if (!manuals || manuals.length === 0) {
    console.log('⚠️ No manuals to import');
    return NextResponse.json({
      success: true,
      importedCount: 0,
      createdManuals: [],
      warning: 'No manuals provided to import'
    });
  }
  
  const db = getDb();
  const createdManuals = [];
  const errors: string[] = [];
  
  // Collect all unique ingredient names for batch linking
  const allIngredientNames = new Set<string>();
  for (const manual of manuals) {
    for (const ing of manual.ingredients) {
      if (ing.name) allIngredientNames.add(ing.name);
    }
  }
  
  // Auto-link ingredients to master
  const ingredientLinks = await autoLinkIngredients(db, Array.from(allIngredientNames));
  const linkedCount = ingredientLinks.size;
  
  for (const manual of manuals) {
    try {
      const manualId = generateId();
      const now = new Date().toISOString();
      
      console.log(`📝 Creating manual: ${manual.name}`);
      
      // Create manual
      await db.execute({
        sql: `INSERT INTO MenuManual (id, name, koreanName, sellingPrice, shelfLife, cookingMethod, isMaster, isActive, isArchived, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, ?, ?)`,
        args: [
          manualId,
          manual.name,
          manual.koreanName,
          manual.sellingPrice || null,
          manual.shelfLife || null,
          manual.cookingMethod ? JSON.stringify(manual.cookingMethod) : null,
          now,
          now
        ],
      });
      
      // Create ingredients with auto-linked ingredientId
      for (let idx = 0; idx < manual.ingredients.length; idx++) {
        const ing = manual.ingredients[idx];
        const ingId = generateId();
        
        // Get linked master ingredient ID
        const linkedMaster = ingredientLinks.get(ing.name);
        const ingredientId = linkedMaster?.id || null;
        
        await db.execute({
          sql: `INSERT INTO ManualIngredient (id, manualId, ingredientId, name, koreanName, quantity, unit, sortOrder, notes, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            ingId,
            manualId,
            ingredientId,
            ing.name,
            ing.koreanName || ing.name,
            ing.quantity || 0,
            ing.unit || 'g',
            idx,
            ing.purchase || null,
            now,
            now
          ],
        });
      }
      
      createdManuals.push({ id: manualId, name: manual.name });
      console.log('✅ Created manual:', manual.name);
    } catch (createError: any) {
      console.error('❌ Failed to create manual:', manual.name, createError?.message);
      errors.push(`${manual.name}: ${createError?.message}`);
    }
  }

  console.log(`✅ Total created: ${createdManuals.length} manuals, ${errors.length} errors`);
  console.log(`🔗 Auto-linked ${linkedCount} unique ingredients`);

  return NextResponse.json({
    success: true,
    importedCount: createdManuals.length,
    createdManuals: createdManuals,
    linkedIngredients: linkedCount,
    errors: errors.length > 0 ? errors : undefined
  });
}

