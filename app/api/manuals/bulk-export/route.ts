import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { matchProcessPng, DEFAULT_PROCESS_ASSET_INDEX } from '@/lib/processAssets';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for large exports

function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
}

// Template Configuration
const TEMPLATE_CONFIG = {
  columnWidths: { A: 3, B: 14.14, C: 5.57, D: 6.29, E: 28.43, F: 6.57, G: 5.57, H: 10.43, I: 6, J: 19.43 },
  rowHeights: {
    title: 28.5, picture: 22.5, ingredientHeader: 18, ingredient: 21,
    bbqCanada: 15, cookingHeader: 28, cookingSubHeader: 18, cookingRow: 18,
  },
  picture: { maxHeightPx: 257, maxWidthPx: 416 },
  pngIcon: { widthPx: 160, heightPx: 57 },
};

const FONTS = {
  title: { name: 'Calibri', size: 20, bold: true, color: { argb: 'FF000000' } },
  menuName: { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF000000' } },
  sectionHeader: { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF000000' } },
  ingredientHeader: { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF000000' } },
  ingredientLabel: { name: 'Calibri', size: 12, bold: true },
  content: { name: 'Calibri', size: 12 },
  small: { name: 'Arial', size: 10, bold: true },
  pictureLabel: { name: 'Calibri', size: 12, bold: true },
};

const COLORS = { grayBg: 'FFBFBFBF', whiteBg: 'FFFFFFFF', black: 'FF000000' };

const border = (style: ExcelJS.BorderStyle) => ({ style, color: { argb: COLORS.black } });
const mediumBorder = border('medium');
const thinBorder = border('thin');

const PROCESS_ICONS: Record<string, string> = {
  'Ingredients Preparation': 'Ingredients Preparation.png',
  'Marination': 'Marination.png', '2nd Marination': '2nd Marination.png',
  'Batter Mix Solution': 'Batter Mix Solution.png', 'Battering': 'Battering.png',
  'Breading': 'Breading.png', 'Frying': 'Frying.png', 'Grill': 'Grill.png',
  'Cooking': 'Cooking.png', 'Saute': 'Saute.png', 'Sauce Mix': 'Sauce Mix.png',
  'Brushing Sauce': 'Brushing Sauce.png', 'Seasoning Toss': 'Seasoning Toss.png',
  'Assembling': 'Assembling.png', 'Serving': 'Serving.png',
};

// Build a single manual sheet
async function buildManualSheet(workbook: ExcelJS.Workbook, manual: any, ingredients: any[]) {
  const sheetName = (manual.name || manual.koreanName || 'Manual').slice(0, 31).replace(/[\\/*?[\]:]/g, '_');
  const ws = workbook.addWorksheet(sheetName);

  // Set column widths
  Object.entries(TEMPLATE_CONFIG.columnWidths).forEach(([col, width]) => {
    ws.getColumn(col).width = width;
  });

  // Parse cooking method
  let cookingSteps: any[] = [];
  if (manual.cookingMethod) {
    try {
      const parsed = typeof manual.cookingMethod === 'string' ? JSON.parse(manual.cookingMethod) : manual.cookingMethod;
      if (Array.isArray(parsed)) cookingSteps = parsed;
    } catch {}
  }

  // Row 1-2: Title
  ws.getRow(1).height = TEMPLATE_CONFIG.rowHeights.title;
  ws.getRow(2).height = TEMPLATE_CONFIG.rowHeights.title;
  ws.mergeCells('B1:J2');
  const titleCell = ws.getCell('B1');
  titleCell.value = 'BBQ PRODUCT MANUAL';
  titleCell.font = FONTS.title;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
  titleCell.border = { top: mediumBorder, left: mediumBorder, right: mediumBorder, bottom: thinBorder };

  // Row 3: Menu Name Header
  ws.getRow(3).height = TEMPLATE_CONFIG.rowHeights.picture;
  ws.mergeCells('B3:B11');
  const menuHeader = ws.getCell('B3');
  menuHeader.value = 'MENU\nNAME';
  menuHeader.font = FONTS.pictureLabel;
  menuHeader.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  menuHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
  menuHeader.border = { top: thinBorder, left: mediumBorder, right: thinBorder, bottom: thinBorder };

  // Menu name display (C3:J4)
  ws.mergeCells('C3:J4');
  const menuNameCell = ws.getCell('C3');
  menuNameCell.value = manual.koreanName ? `${manual.name || ''}\n${manual.koreanName}` : (manual.name || '');
  menuNameCell.font = FONTS.menuName;
  menuNameCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  menuNameCell.border = { top: thinBorder, right: mediumBorder };

  // Picture area (C5:H11)
  for (let r = 5; r <= 11; r++) ws.getRow(r).height = TEMPLATE_CONFIG.rowHeights.picture;
  ws.mergeCells('C5:H11');
  ws.getCell('C5').border = { left: thinBorder, bottom: thinBorder };

  // Add product image if available
  if (manual.imageUrl) {
    try {
      let imageBuffer: Buffer | null = null;
      let extension: 'png' | 'jpeg' | 'gif' = 'png';

      if (manual.imageUrl.startsWith('data:image')) {
        const matches = manual.imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          extension = matches[1] === 'jpg' ? 'jpeg' : (matches[1] as 'png' | 'jpeg' | 'gif');
          imageBuffer = Buffer.from(matches[2], 'base64');
        }
      }

      if (imageBuffer) {
        const imageId = workbook.addImage({ buffer: imageBuffer as any, extension });
        ws.addImage(imageId, {
          tl: { col: 2, row: 4 } as any,
          br: { col: 8, row: 11 } as any,
          editAs: 'oneCell',
        });
      }
    } catch (imgErr) {
      console.error('Image error:', imgErr);
    }
  }

  // Right info panel (I5:J11)
  ws.mergeCells('I5:I6');
  ws.getCell('I5').value = '매장유통기한';
  ws.getCell('I5').font = FONTS.small;
  ws.getCell('I5').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getCell('I5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
  ws.getCell('I5').border = { top: thinBorder, left: thinBorder, right: thinBorder, bottom: thinBorder };

  ws.mergeCells('J5:J6');
  ws.getCell('J5').value = manual.shelfLife || '';
  ws.getCell('J5').font = FONTS.content;
  ws.getCell('J5').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('J5').border = { top: thinBorder, right: mediumBorder, bottom: thinBorder };

  // More info cells (I7:J11)
  const infoLabels = [
    { row: 7, label: 'Yield', value: manual.yield ? `${manual.yield} ${manual.yieldUnit || ''}` : '' },
    { row: 8, label: 'Selling Price', value: manual.sellingPrice ? `$${manual.sellingPrice}` : '' },
    { row: 9, label: '', value: '' },
    { row: 10, label: '', value: '' },
    { row: 11, label: '', value: '' },
  ];

  infoLabels.forEach(({ row, label, value }) => {
    ws.getCell(`I${row}`).value = label;
    ws.getCell(`I${row}`).font = FONTS.small;
    ws.getCell(`I${row}`).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(`I${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell(`I${row}`).border = { left: thinBorder, right: thinBorder, bottom: thinBorder };

    ws.getCell(`J${row}`).value = value;
    ws.getCell(`J${row}`).font = FONTS.content;
    ws.getCell(`J${row}`).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(`J${row}`).border = { right: mediumBorder, bottom: thinBorder };
  });

  // Row 12: Ingredient header
  ws.getRow(12).height = TEMPLATE_CONFIG.rowHeights.ingredientHeader;
  ws.mergeCells('B12:E12');
  ws.getCell('B12').value = 'INGREDIENTS';
  ws.getCell('B12').font = FONTS.sectionHeader;
  ws.getCell('B12').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('B12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
  ws.getCell('B12').border = { top: thinBorder, left: mediumBorder, bottom: thinBorder };

  // Ingredient column headers
  const ingHeaders = [
    { col: 'F', label: 'WEIGHT' },
    { col: 'G', label: 'UNIT' },
    { col: 'H', label: 'PURCHASE' },
  ];
  ingHeaders.forEach(({ col, label }) => {
    const cell = ws.getCell(`${col}12`);
    cell.value = label;
    cell.font = FONTS.ingredientHeader;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    cell.border = { top: thinBorder, left: thinBorder, right: thinBorder, bottom: thinBorder };
  });

  ws.mergeCells('I12:J12');
  ws.getCell('I12').value = 'OTHERS';
  ws.getCell('I12').font = FONTS.ingredientHeader;
  ws.getCell('I12').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('I12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
  ws.getCell('I12').border = { top: thinBorder, left: thinBorder, right: mediumBorder, bottom: thinBorder };

  // Ingredient rows (13-28)
  const maxIngredientRows = 16;
  for (let i = 0; i < maxIngredientRows; i++) {
    const rowNum = 13 + i;
    ws.getRow(rowNum).height = TEMPLATE_CONFIG.rowHeights.ingredient;

    const ing = ingredients[i];
    
    // No.
    ws.getCell(`B${rowNum}`).value = ing ? i + 1 : '';
    ws.getCell(`B${rowNum}`).font = FONTS.content;
    ws.getCell(`B${rowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(`B${rowNum}`).border = { left: mediumBorder, right: thinBorder, bottom: thinBorder };

    // Empty column C
    ws.getCell(`C${rowNum}`).border = { right: thinBorder, bottom: thinBorder };

    // Ingredient name (D:E merged)
    ws.mergeCells(`D${rowNum}:E${rowNum}`);
    ws.getCell(`D${rowNum}`).value = ing ? (ing.koreanName || ing.name || '') : '';
    ws.getCell(`D${rowNum}`).font = FONTS.content;
    ws.getCell(`D${rowNum}`).alignment = { vertical: 'middle', wrapText: true };
    ws.getCell(`D${rowNum}`).border = { right: thinBorder, bottom: thinBorder };

    // Weight
    ws.getCell(`F${rowNum}`).value = ing?.quantity || '';
    ws.getCell(`F${rowNum}`).font = FONTS.content;
    ws.getCell(`F${rowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(`F${rowNum}`).border = { right: thinBorder, bottom: thinBorder };

    // Unit
    ws.getCell(`G${rowNum}`).value = ing?.unit || '';
    ws.getCell(`G${rowNum}`).font = FONTS.content;
    ws.getCell(`G${rowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(`G${rowNum}`).border = { right: thinBorder, bottom: thinBorder };

    // Purchase
    ws.getCell(`H${rowNum}`).value = ing?.notes || '';
    ws.getCell(`H${rowNum}`).font = FONTS.content;
    ws.getCell(`H${rowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(`H${rowNum}`).border = { right: thinBorder, bottom: thinBorder };

    // Others
    ws.mergeCells(`I${rowNum}:J${rowNum}`);
    ws.getCell(`I${rowNum}`).border = { right: mediumBorder, bottom: thinBorder };
  }

  // BBQ CANADA row
  const bbqRow = 29;
  ws.getRow(bbqRow).height = TEMPLATE_CONFIG.rowHeights.bbqCanada;
  ws.mergeCells(`B${bbqRow}:J${bbqRow}`);
  ws.getCell(`B${bbqRow}`).value = 'BBQ CANADA';
  ws.getCell(`B${bbqRow}`).font = FONTS.small;
  ws.getCell(`B${bbqRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell(`B${bbqRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
  ws.getCell(`B${bbqRow}`).border = { left: mediumBorder, right: mediumBorder, bottom: thinBorder };

  // Cooking Method Header
  const cookingHeaderRow = 30;
  ws.getRow(cookingHeaderRow).height = TEMPLATE_CONFIG.rowHeights.cookingHeader;
  ws.mergeCells(`B${cookingHeaderRow}:J${cookingHeaderRow}`);
  ws.getCell(`B${cookingHeaderRow}`).value = 'COOKING METHOD';
  ws.getCell(`B${cookingHeaderRow}`).font = FONTS.sectionHeader;
  ws.getCell(`B${cookingHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell(`B${cookingHeaderRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
  ws.getCell(`B${cookingHeaderRow}`).border = { left: mediumBorder, right: mediumBorder, top: thinBorder, bottom: thinBorder };

  // Cooking sub-header
  const cookingSubRow = 31;
  ws.getRow(cookingSubRow).height = TEMPLATE_CONFIG.rowHeights.cookingSubHeader;
  ws.mergeCells(`B${cookingSubRow}:D${cookingSubRow}`);
  ws.getCell(`B${cookingSubRow}`).value = 'PROCESS';
  ws.getCell(`B${cookingSubRow}`).font = FONTS.ingredientHeader;
  ws.getCell(`B${cookingSubRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell(`B${cookingSubRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
  ws.getCell(`B${cookingSubRow}`).border = { left: mediumBorder, right: thinBorder, bottom: thinBorder };

  ws.mergeCells(`E${cookingSubRow}:J${cookingSubRow}`);
  ws.getCell(`E${cookingSubRow}`).value = 'MANUAL';
  ws.getCell(`E${cookingSubRow}`).font = FONTS.ingredientHeader;
  ws.getCell(`E${cookingSubRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell(`E${cookingSubRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
  ws.getCell(`E${cookingSubRow}`).border = { right: mediumBorder, bottom: thinBorder };

  // Cooking steps
  let currentRow = 32;
  for (const step of cookingSteps) {
    if (!step.process && !step.manual && !step.translatedManual) continue;

    ws.getRow(currentRow).height = 40; // Increased height for icons

    // Process column (B:D merged)
    ws.mergeCells(`B${currentRow}:D${currentRow}`);
    ws.getCell(`B${currentRow}`).value = step.process || '';
    ws.getCell(`B${currentRow}`).font = FONTS.content;
    ws.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws.getCell(`B${currentRow}`).border = { left: mediumBorder, right: thinBorder, bottom: thinBorder };

    // Add process icon if available
    const pngFilename = step.pngFilename || PROCESS_ICONS[step.process];
    if (pngFilename) {
      try {
        const pngPath = path.join(process.cwd(), 'public', 'process-icons', pngFilename);
        if (fs.existsSync(pngPath)) {
          const imageBuffer = fs.readFileSync(pngPath);
          const imageId = workbook.addImage({ buffer: imageBuffer as any, extension: 'png' });
          ws.addImage(imageId, {
            tl: { col: 1, row: currentRow - 1 + 0.1 } as any,
            ext: { width: TEMPLATE_CONFIG.pngIcon.widthPx, height: TEMPLATE_CONFIG.pngIcon.heightPx }
          });
        }
      } catch {}
    }

    // Manual column (E:J merged)
    ws.mergeCells(`E${currentRow}:J${currentRow}`);
    ws.getCell(`E${currentRow}`).value = step.translatedManual || step.manual || '';
    ws.getCell(`E${currentRow}`).font = FONTS.content;
    ws.getCell(`E${currentRow}`).alignment = { vertical: 'middle', wrapText: true };
    ws.getCell(`E${currentRow}`).border = { right: mediumBorder, bottom: thinBorder };

    currentRow++;
  }

  // Bottom border
  ws.mergeCells(`B${currentRow}:J${currentRow}`);
  ws.getCell(`B${currentRow}`).border = { top: mediumBorder };
}

// Build a cost sheet for a manual
async function buildCostSheet(workbook: ExcelJS.Workbook, manual: any, ingredients: any[], priceTemplate: any) {
  const sheetName = ((manual.name || manual.koreanName || 'Cost') + '_원가').slice(0, 31).replace(/[\\/*?[\]:]/g, '_');
  const ws = workbook.addWorksheet(sheetName);

  // Set column widths
  ws.getColumn('A').width = 5;
  ws.getColumn('B').width = 8;
  ws.getColumn('C').width = 25;
  ws.getColumn('D').width = 15;
  ws.getColumn('E').width = 10;
  ws.getColumn('F').width = 10;
  ws.getColumn('G').width = 12;
  ws.getColumn('H').width = 12;

  // Title row
  ws.getRow(1).height = 30;
  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `원가 분석표 - ${manual.koreanName || manual.name}`;
  titleCell.font = { name: 'Calibri', size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

  // Header row
  const headers = ['No.', '카테고리', '품목명', '단가', '수량', '단위', '원가', '비고'];
  ws.getRow(2).height = 25;
  headers.forEach((header, idx) => {
    const cell = ws.getCell(2, idx + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFBFBF' } };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    };
  });

  // Data rows
  let totalCost = 0;
  ingredients.forEach((ing, idx) => {
    const row = ws.getRow(idx + 3);
    row.height = 20;

    const unitPrice = ing.unitPrice || 0;
    const quantity = ing.quantity || 0;
    const cost = unitPrice * quantity / (ing.baseQuantity || 1000);
    totalCost += cost;

    const values = [
      idx + 1,
      ing.section || 'MAIN',
      ing.koreanName || ing.name || '',
      unitPrice ? `$${unitPrice.toFixed(2)}` : '',
      quantity,
      ing.unit || 'g',
      cost > 0 ? `$${cost.toFixed(4)}` : '',
      ing.notes || ''
    ];

    values.forEach((val, colIdx) => {
      const cell = ws.getCell(idx + 3, colIdx + 1);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { horizontal: colIdx < 2 ? 'center' : 'left', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      };
    });
  });

  // Total row
  const totalRowNum = ingredients.length + 3;
  ws.getRow(totalRowNum).height = 25;
  ws.mergeCells(`A${totalRowNum}:F${totalRowNum}`);
  ws.getCell(`A${totalRowNum}`).value = '총 원가';
  ws.getCell(`A${totalRowNum}`).font = { name: 'Calibri', size: 12, bold: true };
  ws.getCell(`A${totalRowNum}`).alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getCell(`A${totalRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };

  ws.getCell(`G${totalRowNum}`).value = `$${totalCost.toFixed(4)}`;
  ws.getCell(`G${totalRowNum}`).font = { name: 'Calibri', size: 12, bold: true };
  ws.getCell(`G${totalRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell(`G${totalRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };

  // Selling price & margin if available
  if (manual.sellingPrice) {
    const marginRowNum = totalRowNum + 1;
    ws.getRow(marginRowNum).height = 20;
    ws.mergeCells(`A${marginRowNum}:F${marginRowNum}`);
    ws.getCell(`A${marginRowNum}`).value = '판매가';
    ws.getCell(`A${marginRowNum}`).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell(`G${marginRowNum}`).value = `$${manual.sellingPrice.toFixed(2)}`;
    ws.getCell(`G${marginRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };

    const margin = ((manual.sellingPrice - totalCost) / manual.sellingPrice * 100).toFixed(1);
    const marginRow2 = marginRowNum + 1;
    ws.getRow(marginRow2).height = 20;
    ws.mergeCells(`A${marginRow2}:F${marginRow2}`);
    ws.getCell(`A${marginRow2}`).value = '마진율';
    ws.getCell(`A${marginRow2}`).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell(`G${marginRow2}`).value = `${margin}%`;
    ws.getCell(`G${marginRow2}`).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(`G${marginRow2}`).font = { 
      name: 'Calibri', size: 12, bold: true, 
      color: { argb: parseFloat(margin) >= 60 ? 'FF008000' : 'FFFF0000' } 
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { manualIds, includeManual = true, includeCost = false } = await request.json();

    if (!manualIds || !Array.isArray(manualIds) || manualIds.length === 0) {
      return NextResponse.json({ error: 'manualIds array is required' }, { status: 400 });
    }

    const db = getDb();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BBQ Franchise Management';
    workbook.created = new Date();

    // Fetch all manuals and ingredients
    for (const manualId of manualIds) {
      // Fetch manual
      const manualResult = await db.execute({
        sql: `SELECT * FROM MenuManual WHERE id = ?`,
        args: [manualId],
      });

      if (manualResult.rows.length === 0) continue;
      const manualRow = manualResult.rows[0];

      // Fetch ingredients
      const ingredientsResult = await db.execute({
        sql: `SELECT * FROM ManualIngredient WHERE manualId = ? ORDER BY sortOrder ASC`,
        args: [manualId],
      });

      const manual = {
        id: String(manualRow.id || ''),
        name: String(manualRow.name || ''),
        koreanName: String(manualRow.koreanName || ''),
        yield: manualRow.yield ? Number(manualRow.yield) : null,
        yieldUnit: String(manualRow.yieldUnit || ''),
        sellingPrice: manualRow.sellingPrice ? Number(manualRow.sellingPrice) : null,
        imageUrl: String(manualRow.imageUrl || ''),
        shelfLife: String(manualRow.shelfLife || ''),
        cookingMethod: manualRow.cookingMethod,
      };

      const ingredients = ingredientsResult.rows.map(row => ({
        id: String(row.id || ''),
        name: String(row.name || ''),
        koreanName: String(row.koreanName || ''),
        quantity: row.quantity ? Number(row.quantity) : 0,
        unit: String(row.unit || 'g'),
        sortOrder: row.sortOrder ? Number(row.sortOrder) : 0,
        notes: String(row.notes || ''),
        section: String(row.section || 'MAIN'),
        unitPrice: row.unitPrice ? Number(row.unitPrice) : 0,
        baseQuantity: row.baseQuantity ? Number(row.baseQuantity) : 1000,
      }));

      // Add manual sheet if requested
      if (includeManual) {
        await buildManualSheet(workbook, manual, ingredients);
      }

      // Add cost sheet if requested
      if (includeCost) {
        await buildCostSheet(workbook, manual, ingredients, null);
      }
    }

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="BBQ_Bulk_Export.xlsx"',
      },
    });
  } catch (error: any) {
    console.error('Bulk export error:', error);
    return NextResponse.json({ error: error.message || 'Export failed' }, { status: 500 });
  }
}
