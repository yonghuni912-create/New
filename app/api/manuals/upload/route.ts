import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auditLog';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

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
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    
    // Handle direct import mode (JSON body with confirmed manuals)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      if (body.importMode === 'import-direct' && body.manuals) {
        return handleDirectImport(body.manuals, session);
      }
    }
    
    // Handle file upload mode
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const importMode = formData.get('importMode') as string || 'preview'; // 'preview' | 'import'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    console.log('📊 Excel sheets:', workbook.SheetNames);

    const parsedManuals: ParsedManual[] = [];
    const manualsWithIssues: ParsedManual[] = [];

    // Process each sheet as a separate manual
    for (const sheetName of workbook.SheetNames) {
      // Skip sheets that don't look like manual sheets
      if (sheetName.toLowerCase().includes('summary') || 
          sheetName.toLowerCase().includes('목차') ||
          sheetName.toLowerCase().includes('index')) {
        continue;
      }

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
    }

    // If preview mode, just return the parsed data
    if (importMode === 'preview') {
      // Combine all manuals for individual preview
      const allManuals = [...parsedManuals, ...manualsWithIssues];
      
      return NextResponse.json({
        success: true,
        totalSheets: workbook.SheetNames.length,
        parsedCount: parsedManuals.length,
        issuesCount: manualsWithIssues.length,
        manuals: parsedManuals,
        manualsWithIssues,
        allManuals // For individual preview navigation
      });
    }

    // Import mode - create manuals in database
    const createdManuals = [];
    for (const manual of parsedManuals) {
      const created = await prisma.menuManual.create({
        data: {
          name: manual.name,
          koreanName: manual.koreanName,
          sellingPrice: manual.sellingPrice,
          shelfLife: manual.shelfLife,
          cookingMethod: manual.cookingMethod ? JSON.stringify(manual.cookingMethod) : null,
          isMaster: true,
          isActive: true,
          isArchived: false,
          ingredients: {
            create: manual.ingredients.map((ing, idx) => ({
              name: ing.name,
              koreanName: ing.koreanName,
              quantity: ing.quantity,
              unit: ing.unit,
              sortOrder: idx,
              notes: ing.purchase
            }))
          }
        }
      });
      createdManuals.push(created);
    }

    // Create audit log
    await createAuditLog({
      userId: (session.user as { id: string }).id,
      action: 'MANUAL_CREATE',
      entityType: 'MenuManual',
      entityId: 'bulk-import',
      newValue: { 
        importedCount: createdManuals.length, 
        fileName: file.name,
        issuesCount: manualsWithIssues.length
      }
    });

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
async function handleDirectImport(manuals: ParsedManual[], session: any) {
  const createdManuals = [];
  
  for (const manual of manuals) {
    try {
      const created = await prisma.menuManual.create({
        data: {
          name: manual.name,
          koreanName: manual.koreanName,
          sellingPrice: manual.sellingPrice,
          shelfLife: manual.shelfLife,
          cookingMethod: manual.cookingMethod ? JSON.stringify(manual.cookingMethod) : null,
          isMaster: true,
          isActive: true,
          ingredients: {
            create: manual.ingredients.map((ing, index) => ({
              name: ing.name,
              koreanName: ing.koreanName || ing.name,
              quantity: ing.quantity || 0,
              unit: ing.unit || 'g',
              notes: ing.purchase,
              sortOrder: index
            }))
          }
        }
      });
      createdManuals.push(created);
    } catch (createError) {
      console.error('Failed to create manual:', manual.name, createError);
    }
  }

  // Create audit log
  try {
    await createAuditLog({
      action: 'MANUAL_IMPORT',
      userId: session.user.id,
      entityType: 'MenuManual',
      entityId: 'bulk-import',
      newValue: { importedCount: createdManuals.length }
    });
  } catch (err) {
    console.warn('Failed to create audit log:', err);
  }

  return NextResponse.json({
    success: true,
    importedCount: createdManuals.length,
    createdManuals: createdManuals.map(m => ({ id: m.id, name: m.name }))
  });
}

