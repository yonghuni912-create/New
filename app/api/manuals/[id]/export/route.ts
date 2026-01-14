import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

// Type for manual ingredient
interface ManualIngredientData {
  id: string;
  name?: string | null;
  koreanName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  section?: string | null;
  notes?: string | null;
  ingredientId?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// Default cooking processes
const DEFAULT_PROCESSES = [
  'Ingredients Preparation',
  'Marination',
  'Batter Mix Solution Preparation',
  'Battering',
  'Breading',
  'Frying',
  'Assemble',
  'Take Out & Delivery'
];

// Border styles
const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' }
};

const thickBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'medium' },
  left: { style: 'medium' },
  bottom: { style: 'medium' },
  right: { style: 'medium' }
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch manual with ingredients and cost versions
    const manual = await db.menuManual.findUnique({
      where: { id },
      include: {
        ingredients: {
          orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }]
        },
        costVersions: {
          select: {
            id: true,
            manualId: true,
            templateId: true,
            description: true,
            totalCost: true,
            costPerUnit: true,
            calculatedAt: true,
            createdAt: true,
            updatedAt: true,
            template: true
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!manual) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }

    // Parse cooking method
    let cookingSteps: any[] = [];
    if (manual.cookingMethod) {
      try {
        cookingSteps = typeof manual.cookingMethod === 'string' 
          ? JSON.parse(manual.cookingMethod) 
          : manual.cookingMethod as any[];
      } catch (e) {
        cookingSteps = [];
      }
    }

    // Cast ingredients to typed array
    const ingredients = manual.ingredients as ManualIngredientData[];
    const mainIngredients = ingredients.filter((ing: ManualIngredientData) => ing.section === 'MAIN' || !ing.section);
    const sauceIngredients = ingredients.filter((ing: ManualIngredientData) => ing.section === 'SAUCE');
    const allIngredients = [...mainIngredients, ...sauceIngredients];

    // Create workbook with ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BBQ Canada';
    workbook.created = new Date();

    // =============================================
    // SINGLE SHEET: INGREDIENTS + COOKING METHOD
    // =============================================
    const sheet = workbook.addWorksheet('Manual', {
      pageSetup: { paperSize: 9, orientation: 'portrait' }
    });

    // Set column widths
    sheet.columns = [
      { width: 2 },    // A
      { width: 15 },   // B
      { width: 6 },    // C
      { width: 6 },    // D
      { width: 30 },   // E
      { width: 8 },    // F
      { width: 6 },    // G
      { width: 12 },   // H
      { width: 6 },    // I
      { width: 20 }    // J
    ];

    // Row 1: Title - "Manual(Kitchen)"
    sheet.mergeCells('B1:J1');
    const titleCell1 = sheet.getCell('B1');
    titleCell1.value = 'Manual(Kitchen)';
    titleCell1.font = { bold: true, size: 16 };
    titleCell1.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    titleCell1.border = thickBorder;
    sheet.getRow(1).height = 30;

    // Row 2: Name
    sheet.mergeCells('C2:J2');
    sheet.getCell('B2').value = 'Name';
    sheet.getCell('B2').font = { bold: true };
    sheet.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    sheet.getCell('B2').border = thinBorder;
    sheet.getCell('C2').value = manual.name;
    sheet.getCell('C2').font = { bold: true, size: 14 };
    sheet.getCell('C2').border = thinBorder;
    sheet.getRow(2).height = 25;

    // Rows 3-11: Picture area + Item List
    sheet.mergeCells('B3:B11');
    const pictureLabel = sheet.getCell('B3');
    pictureLabel.value = 'Picture';
    pictureLabel.font = { bold: true };
    pictureLabel.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
    pictureLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    pictureLabel.border = thickBorder;

    // Picture area with visible border
    sheet.mergeCells('C3:H11');
    const pictureArea = sheet.getCell('C3');
    pictureArea.alignment = { horizontal: 'center', vertical: 'middle' };
    pictureArea.border = thickBorder;
    pictureArea.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } };

    // If manual has image, try to add it (image fits to cell, not vice versa)
    if (manual.imageUrl) {
      try {
        // Base64 이미지인 경우
        if (manual.imageUrl.startsWith('data:')) {
          const matches = manual.imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
          if (matches) {
            const extension = matches[1] as 'png' | 'jpeg' | 'gif';
            const base64Data = matches[2];
            const imageId = workbook.addImage({
              base64: base64Data,
              extension: extension,
            });
            sheet.addImage(imageId, 'C3:H11');
          }
        } else {
          // URL인 경우 fetch 후 base64로 변환
          const response = await fetch(manual.imageUrl);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString('base64');
            const contentType = response.headers.get('content-type') || 'image/png';
            const extension = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpeg' : 
                              contentType.includes('gif') ? 'gif' : 'png';
            const imageId = workbook.addImage({
              base64: base64Data,
              extension: extension as 'png' | 'jpeg' | 'gif',
            });
            sheet.addImage(imageId, 'C3:H11');
          }
        }
      } catch (e) {
        pictureArea.value = '[Image]';
      }
    } else {
      pictureArea.value = '';
    }

    // Item List header
    sheet.mergeCells('I3:J3');
    sheet.getCell('I3').value = 'Item List';
    sheet.getCell('I3').font = { bold: true };
    sheet.getCell('I3').alignment = { horizontal: 'center' };
    sheet.getCell('I3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    sheet.getCell('I3').border = thinBorder;

    // Item List area (I4:J11 merged) - like template
    sheet.mergeCells('I4:J11');
    const itemListCell = sheet.getCell('I4');
    const itemListItems = mainIngredients.slice(0, 8).map((ing: ManualIngredientData) => ing.name || ing.koreanName || '');
    itemListCell.value = itemListItems.join('\n');
    itemListCell.alignment = { vertical: 'top', wrapText: true };
    itemListCell.border = thinBorder;

    // Set row heights for picture area
    for (let i = 3; i <= 11; i++) {
      sheet.getRow(i).height = 21.75;
    }

    // Row 12: Ingredients Composition header
    const ingHeaderRow = 12;
    sheet.mergeCells(`B${ingHeaderRow}:B${ingHeaderRow + 1}`);
    sheet.getCell(`B${ingHeaderRow}`).value = 'Ingredients\nComposition';
    sheet.getCell(`B${ingHeaderRow}`).font = { bold: true };
    sheet.getCell(`B${ingHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    sheet.getCell(`B${ingHeaderRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    sheet.getCell(`B${ingHeaderRow}`).border = thinBorder;

    // Column headers
    const headerLabels = ['No.', '', 'Ingredients', 'Weight', 'Unit', 'Purchase', '', 'Others'];
    for (let col = 3; col <= 10; col++) {
      const cell = sheet.getRow(ingHeaderRow).getCell(col);
      cell.value = headerLabels[col - 3];
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
      cell.border = thinBorder;
    }
    sheet.getRow(ingHeaderRow).height = 20;

    // Dynamic ingredient rows - only show actual ingredients (not fixed 25)
    const INGREDIENT_ROW_COUNT = Math.max(allIngredients.length, 10); // At least 10 rows for layout
    
    // Ingredients data rows
    let currentRow = ingHeaderRow + 1;
    for (let i = 0; i < INGREDIENT_ROW_COUNT; i++) {
      const ing = allIngredients[i];
      
      if (ing) {
        // Fill with actual ingredient data
        sheet.getCell(`C${currentRow}`).value = i + 1;
        sheet.getCell(`C${currentRow}`).alignment = { horizontal: 'center' };
        sheet.getCell(`E${currentRow}`).value = ing.name || ing.koreanName || '';
        sheet.getCell(`F${currentRow}`).value = ing.quantity || '';
        sheet.getCell(`F${currentRow}`).alignment = { horizontal: 'center' };
        sheet.getCell(`G${currentRow}`).value = ing.unit || '';
        sheet.getCell(`G${currentRow}`).alignment = { horizontal: 'center' };
        sheet.getCell(`H${currentRow}`).value = ing.notes || '';
        sheet.getCell(`H${currentRow}`).alignment = { horizontal: 'center' };
      } else {
        // Empty row placeholder
        sheet.getCell(`C${currentRow}`).value = i + 1;
        sheet.getCell(`C${currentRow}`).alignment = { horizontal: 'center' };
      }

      for (let col = 2; col <= 10; col++) {
        sheet.getRow(currentRow).getCell(col).border = thinBorder;
      }
      sheet.getRow(currentRow).height = 18;
      currentRow++;
    }

    // Check for SAUCE section - add separate header if sauce ingredients exist
    if (sauceIngredients.length > 0) {
      // Find the sauce section start index
      const sauceStartIndex = mainIngredients.length;
      
      // Add sauce header row if there are sauce ingredients
      // Find where sauce starts in our ingredient list and add header before it
      const sauceHeaderRow = ingHeaderRow + 1 + sauceStartIndex;
      
      // Insert sauce section header (will be added as part of ingredient loop if needed)
    }

    // =============================================
    // COOKING METHOD SECTION (same sheet, continuous)
    // =============================================
    
    // Empty separator row
    currentRow++;
    sheet.getRow(currentRow).height = 10;
    currentRow++;

    // COOKING METHOD Title
    sheet.mergeCells(`B${currentRow}:J${currentRow}`);
    const cookingTitle = sheet.getCell(`B${currentRow}`);
    cookingTitle.value = 'COOKING METHOD';
    cookingTitle.font = { bold: true, size: 16 };
    cookingTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    cookingTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    cookingTitle.border = thickBorder;
    sheet.getRow(currentRow).height = 30;
    currentRow++;

    // COOKING METHOD Headers
    sheet.mergeCells(`B${currentRow}:D${currentRow}`);
    sheet.getCell(`B${currentRow}`).value = 'PROCESS';
    sheet.getCell(`B${currentRow}`).font = { bold: true };
    sheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell(`B${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    sheet.getCell(`B${currentRow}`).border = thinBorder;

    sheet.mergeCells(`E${currentRow}:J${currentRow}`);
    sheet.getCell(`E${currentRow}`).value = 'MANUAL';
    sheet.getCell(`E${currentRow}`).font = { bold: true };
    sheet.getCell(`E${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell(`E${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    sheet.getCell(`E${currentRow}`).border = thinBorder;
    sheet.getRow(currentRow).height = 25;
    currentRow++;

    // Cooking steps - natural flow
    for (const processName of DEFAULT_PROCESSES) {
      const step = cookingSteps.find((s: any) => s.process === processName);
      const manualText = step?.translatedManual || step?.manual || '';
      const lines = manualText.split('\n').filter((line: string) => line.trim());

      // Process name cell (B:D merged)
      sheet.mergeCells(`B${currentRow}:D${currentRow}`);
      sheet.getCell(`B${currentRow}`).value = processName;
      sheet.getCell(`B${currentRow}`).font = { bold: true };
      sheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      sheet.getCell(`B${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
      sheet.getCell(`B${currentRow}`).border = thickBorder;

      // Manual content (E:J merged) - all lines combined with line breaks
      sheet.mergeCells(`E${currentRow}:J${currentRow}`);
      const manualCell = sheet.getCell(`E${currentRow}`);
      manualCell.value = lines.length > 0 ? lines.map((line: string, idx: number) => `${idx + 1}. ${line}`).join('\n') : '';
      manualCell.alignment = { vertical: 'top', wrapText: true };
      manualCell.border = thinBorder;

      // Dynamic row height based on content
      const lineCount = Math.max(1, lines.length);
      sheet.getRow(currentRow).height = Math.max(25, lineCount * 18);
      currentRow++;
    }

    // Empty row before footer
    currentRow++;
    sheet.getRow(currentRow).height = 10;
    currentRow++;
    
    // Footer: BBQ CANADA
    sheet.mergeCells(`I${currentRow}:J${currentRow}`);
    const footer = sheet.getCell(`I${currentRow}`);
    footer.value = 'BBQ CANADA';
    footer.font = { bold: true, size: 12 };
    footer.alignment = { horizontal: 'right', vertical: 'middle' };
    footer.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    footer.border = thickBorder;
    sheet.getRow(currentRow).height = 17.25;

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Generate filename with date
    const today = new Date();
    const dateStr = `${String(today.getFullYear()).slice(-2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const cleanName = manual.name.replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_');
    const filename = `${dateStr}_${cleanName}_Manual.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });

  } catch (error) {
    console.error('Excel export error:', error);
    return NextResponse.json({ error: 'Failed to export Excel' }, { status: 500 });
  }
}
