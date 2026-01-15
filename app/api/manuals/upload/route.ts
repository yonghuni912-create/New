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

// Parse a single sheet as a manual
function parseManualSheet(sheetName: string, data: any[][]): ParsedManual | null {
  if (data.length < 5) return null;

  let name = '';
  let koreanName = '';
  let sellingPrice: number | undefined;
  let shelfLife: string | undefined;
  const ingredients: ParsedManual['ingredients'] = [];
  const cookingMethod: ParsedManual['cookingMethod'] = [];
  const issueDetails: string[] = [];

  // Try to find menu name from sheet data
  // Common patterns: first row header, or labeled cells
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i] || [];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toLowerCase();
      const nextCell = row[j + 1];

      if (cell.includes('menu name') || cell.includes('name') || cell === '메뉴명') {
        name = String(nextCell || '').trim();
      }
      if (cell.includes('korean') || cell === '한글명' || cell === '메뉴명(한글)') {
        koreanName = String(nextCell || '').trim();
      }
      if (cell.includes('selling') || cell.includes('price') || cell === '판매가') {
        const priceVal = parseFloat(String(nextCell || '0').replace(/[^0-9.]/g, ''));
        if (!isNaN(priceVal)) sellingPrice = priceVal;
      }
      if (cell.includes('shelf') || cell === '유통기한') {
        shelfLife = String(nextCell || '').trim();
      }
    }
  }

  // If no name found, use sheet name
  if (!name && !koreanName) {
    name = sheetName;
    koreanName = sheetName;
  }

  // Find ingredients section
  let ingredientStartRow = -1;
  for (let i = 0; i < data.length; i++) {
    const row = data[i] || [];
    const rowText = row.join(' ').toLowerCase();
    if (rowText.includes('ingredient') || rowText.includes('재료') || 
        rowText.includes('material') || rowText.includes('식재료')) {
      ingredientStartRow = i + 1;
      break;
    }
  }

  // Parse ingredients
  if (ingredientStartRow > 0) {
    for (let i = ingredientStartRow; i < data.length && i < ingredientStartRow + 30; i++) {
      const row = data[i] || [];
      if (row.length < 2) continue;
      
      // Check if this row looks like cooking method start
      const rowText = row.join(' ').toLowerCase();
      if (rowText.includes('cooking') || rowText.includes('method') || 
          rowText.includes('조리') || rowText.includes('과정')) {
        break;
      }

      // Try to extract ingredient: name, quantity, unit
      const ingName = String(row[0] || row[1] || '').trim();
      if (!ingName || ingName.toLowerCase().includes('total') || 
          ingName.toLowerCase().includes('합계')) continue;

      const quantityCol = row.find((c: any) => !isNaN(parseFloat(String(c))));
      const quantity = quantityCol ? parseFloat(String(quantityCol)) : 0;
      
      // Find unit
      let unit = 'g';
      for (const cell of row) {
        const cellStr = String(cell || '').toLowerCase();
        if (['g', 'kg', 'ml', 'l', 'ea', 'pc', 'pcs', 'oz', 'lb'].includes(cellStr)) {
          unit = cellStr;
          break;
        }
      }

      ingredients.push({
        name: ingName,
        koreanName: ingName,
        quantity,
        unit,
        purchase: 'Local'
      });
    }
  }

  // Find cooking method section
  let cookingStartRow = -1;
  for (let i = 0; i < data.length; i++) {
    const row = data[i] || [];
    const rowText = row.join(' ').toLowerCase();
    if (rowText.includes('cooking') || rowText.includes('method') || 
        rowText.includes('조리방법') || rowText.includes('조리 과정')) {
      cookingStartRow = i + 1;
      break;
    }
  }

  // Parse cooking method
  if (cookingStartRow > 0) {
    for (let i = cookingStartRow; i < data.length && i < cookingStartRow + 20; i++) {
      const row = data[i] || [];
      if (row.length < 2) continue;

      const process = String(row[0] || '').trim();
      const manual = String(row[1] || '').trim();
      
      if (process && manual) {
        cookingMethod.push({
          process,
          manual,
          translatedManual: ''
        });
      }
    }
  }

  // Determine if there are linking issues
  let hasLinkingIssue = false;
  
  // Check if ingredients list is empty
  if (ingredients.length === 0) {
    hasLinkingIssue = true;
    issueDetails.push('식재료 목록을 찾을 수 없습니다');
  }

  // Check if no price template assigned (all imports need this)
  issueDetails.push('가격 템플릿 미지정');

  return {
    name,
    koreanName,
    sellingPrice,
    shelfLife,
    ingredients,
    cookingMethod: cookingMethod.length > 0 ? cookingMethod : undefined,
    hasLinkingIssue: issueDetails.length > 1, // More than just template issue
    issueDetails
  };
}
