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
      return NextResponse.json({
        success: true,
        totalSheets: workbook.SheetNames.length,
        parsedCount: parsedManuals.length,
        issuesCount: manualsWithIssues.length,
        manuals: parsedManuals,
        manualsWithIssues
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

// Parse a single sheet as a manual - BBQ Chicken Format
function parseManualSheet(sheetName: string, data: any[][]): ParsedManual | null {
  if (data.length < 5) return null;

  // Skip non-menu sheets
  const sheetLower = sheetName.toLowerCase();
  if (sheetLower.includes('kitchen manual') || 
      sheetLower.includes('contents') || 
      sheetLower.includes('목차') ||
      sheetLower.includes('index') ||
      sheetLower.includes('summary')) {
    return null;
  }

  let name = sheetName; // Default to sheet name
  let koreanName = '';
  let sellingPrice: number | undefined;
  let shelfLife: string | undefined;
  const ingredients: ParsedManual['ingredients'] = [];
  const cookingMethod: ParsedManual['cookingMethod'] = [];
  const issueDetails: string[] = [];

  // Parse BBQ Chicken format
  // Row 1: ["Name", " Corn Salad "]
  for (let i = 0; i < Math.min(15, data.length); i++) {
    const row = data[i] || [];
    if (row[0] && String(row[0]).toLowerCase().trim() === 'name' && row[1]) {
      name = String(row[1]).trim();
    }
    if (row[0] && (String(row[0]).includes('한글') || String(row[0]).toLowerCase().includes('korean')) && row[1]) {
      koreanName = String(row[1]).trim();
    }
    if (row[0] && (String(row[0]).toLowerCase().includes('price') || String(row[0]).includes('판매가')) && row[1]) {
      const priceVal = parseFloat(String(row[1]).replace(/[^0-9.]/g, ''));
      if (!isNaN(priceVal)) sellingPrice = priceVal;
    }
  }

  // If no Korean name, use English name
  if (!koreanName) {
    koreanName = name;
  }

  // Find ingredients section - look for "Ingredients Composition" or similar header
  let ingredientStartRow = -1;
  let ingredientColIndex = { name: 2, weight: 4, unit: 5, purchase: 6, others: 7 };
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i] || [];
    const rowText = row.map(c => String(c || '').toLowerCase()).join(' ');
    
    if (rowText.includes('ingredients composition') || rowText.includes('ingredients') && rowText.includes('no')) {
      // Found header row, ingredients start on next row
      ingredientStartRow = i + 1;
      
      // Find column indices from header
      for (let j = 0; j < row.length; j++) {
        const cellText = String(row[j] || '').toLowerCase();
        if (cellText.includes('ingredient')) ingredientColIndex.name = j;
        if (cellText.includes('weight')) ingredientColIndex.weight = j;
        if (cellText.includes('unit')) ingredientColIndex.unit = j;
        if (cellText.includes('purchase')) ingredientColIndex.purchase = j;
        if (cellText.includes('other')) ingredientColIndex.others = j;
      }
      break;
    }
  }

  // Parse ingredients
  if (ingredientStartRow > 0) {
    for (let i = ingredientStartRow; i < data.length && i < ingredientStartRow + 50; i++) {
      const row = data[i] || [];
      
      // Check if we hit cooking method section
      const rowText = row.map(c => String(c || '')).join(' ').toLowerCase();
      if (rowText.includes('cooking method') || rowText.includes('process')) {
        break;
      }
      
      // Skip empty rows or header-like rows
      const ingredientName = String(row[ingredientColIndex.name] || row[2] || '').trim();
      if (!ingredientName || ingredientName.toLowerCase().includes('total') || 
          ingredientName.toLowerCase().includes('합계') ||
          ingredientName.startsWith('*')) {
        continue;
      }
      
      // Extract weight and unit
      let weight = 0;
      let unit = 'g';
      
      // Weight is usually in column 4
      const weightVal = row[ingredientColIndex.weight] || row[4];
      if (weightVal !== undefined && weightVal !== null) {
        weight = parseFloat(String(weightVal).replace(/[^0-9.]/g, '')) || 0;
      }
      
      // Unit is usually in column 5
      const unitVal = row[ingredientColIndex.unit] || row[5];
      if (unitVal) {
        unit = String(unitVal).trim().toLowerCase() || 'g';
      }
      
      // Purchase type in column 6
      const purchaseVal = row[ingredientColIndex.purchase] || row[6];
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

  // Find cooking method section
  let cookingStartRow = -1;
  for (let i = 0; i < data.length; i++) {
    const row = data[i] || [];
    const firstCell = String(row[0] || '').toLowerCase();
    if (firstCell.includes('cooking method')) {
      cookingStartRow = i + 2; // Skip header rows
      break;
    }
  }

  // Parse cooking method
  if (cookingStartRow > 0) {
    let currentProcess = 'Cooking';
    const manualSteps: string[] = [];
    
    for (let i = cookingStartRow; i < data.length && i < cookingStartRow + 30; i++) {
      const row = data[i] || [];
      
      // Manual text is usually in column 3 (index 3)
      const manualText = String(row[3] || row[2] || row[1] || '').trim();
      if (manualText && manualText.startsWith('▶')) {
        manualSteps.push(manualText.replace('▶', '').trim());
      } else if (manualText && !manualText.toLowerCase().includes('bbq')) {
        // Continuation of previous step
        if (manualSteps.length > 0) {
          manualSteps[manualSteps.length - 1] += ' ' + manualText.trim();
        }
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

