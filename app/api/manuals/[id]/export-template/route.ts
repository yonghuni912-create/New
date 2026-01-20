import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { matchProcessPng, DEFAULT_PROCESS_ASSET_INDEX } from '@/lib/processAssets';

function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
}

// Template Configuration - 목표 템플릿 기준
const TEMPLATE_CONFIG = {
  // Column widths (Excel units)
  columnWidths: {
    A: 3,       // Margin
    B: 14.14,   // Labels
    C: 5.57,    // No.
    D: 6.29,    // Ingredient name start
    E: 28.43,   // Ingredient name / Manual content
    F: 6.57,    // Weight
    G: 5.57,    // Unit
    H: 10.43,   // Purchase
    I: 6,       // Others start
    J: 19.43,   // Others end
  },
  // Row heights
  rowHeights: {
    title: 28.5,         // Row 1, 2
    picture: 22.5,       // Rows 3-11 (픽셀 30)
    ingredientHeader: 18,// Row 12
    ingredient: 21,      // Rows 13-28
    bbqCanada: 15,       // BBQ CANADA row
    cookingHeader: 28,   // COOKING METHOD header
    cookingSubHeader: 18,// PROCESS/MANUAL row
    cookingRow: 18,      // Default cooking method row
  },
  // Picture constraints (C5:H11 area)
  picture: {
    maxHeightCm: 6.8,
    maxWidthCm: 11,
    maxHeightPx: 257, // 6.8cm at 96dpi ≈ 257px
    maxWidthPx: 416,  // 11cm at 96dpi ≈ 416px
  },
  // PNG icon size - 원본 파일 크기 (높이 1.5cm, 너비 4.22cm)
  pngIcon: {
    widthPx: 160,  // 4.22cm at 96dpi ≈ 160px
    heightPx: 57,  // 1.5cm at 96dpi ≈ 57px
  },
};

// Font styles
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

// Colors
const COLORS = {
  grayBg: 'FFBFBFBF',
  whiteBg: 'FFFFFFFF',
  black: 'FF000000',
};

// Border helpers
const border = (style: ExcelJS.BorderStyle) => ({ style, color: { argb: COLORS.black } });
const mediumBorder = border('medium');
const thinBorder = border('thin');

// Process icon mapping
const PROCESS_ICONS: Record<string, string> = {
  'Ingredients Preparation': 'Ingredients Preparation.png',
  'Marination': 'Marination.png',
  '2nd Marination': '2nd Marination.png',
  'Batter Mix Solution': 'Batter Mix Solution.png',
  'Battering': 'Battering.png',
  'Breading': 'Breading.png',
  'Frying': 'Frying.png',
  'Grill': 'Grill.png',
  'Cooking': 'Cooking.png',
  'Saute': 'Saute.png',
  'Sauce Mix': 'Sauce Mix.png',
  'Brushing Sauce': 'Brushing Sauce.png',
  'Seasoning Toss': 'Seasoning Toss.png',
  'Assembling': 'Assembling.png',
  'Serving': 'Serving.png',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    // Fetch manual
    const manualResult = await db.execute({
      sql: `SELECT * FROM MenuManual WHERE id = ?`,
      args: [id],
    });

    if (manualResult.rows.length === 0) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }

    const manualRow = manualResult.rows[0];

    // Fetch ingredients
    const ingredientsResult = await db.execute({
      sql: `SELECT * FROM ManualIngredient WHERE manualId = ? ORDER BY sortOrder ASC`,
      args: [id],
    });

    // Build manual object
    const manual = {
      id: String(manualRow.id || ''),
      name: String(manualRow.name || ''),
      koreanName: String(manualRow.koreanName || ''),
      yield: String(manualRow.yield || ''),
      yieldUnit: String(manualRow.yieldUnit || ''),
      sellingPrice: manualRow.sellingPrice ? Number(manualRow.sellingPrice) : null,
      imageUrl: String(manualRow.imageUrl || ''),
      shelfLife: String(manualRow.shelfLife || ''),
      cookingMethod: manualRow.cookingMethod,
      ingredients: ingredientsResult.rows.map(row => ({
        id: String(row.id || ''),
        name: String(row.name || ''),
        koreanName: String(row.koreanName || ''),
        quantity: row.quantity ? Number(row.quantity) : 0,
        unit: String(row.unit || 'g'),
        sortOrder: row.sortOrder ? Number(row.sortOrder) : 0,
        notes: String(row.notes || ''),
        section: String(row.section || ''),
      })),
    };

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(String(manual.name) || 'Manual');

    // Set column widths
    ws.getColumn('A').width = TEMPLATE_CONFIG.columnWidths.A;
    ws.getColumn('B').width = TEMPLATE_CONFIG.columnWidths.B;
    ws.getColumn('C').width = TEMPLATE_CONFIG.columnWidths.C;
    ws.getColumn('D').width = TEMPLATE_CONFIG.columnWidths.D;
    ws.getColumn('E').width = TEMPLATE_CONFIG.columnWidths.E;
    ws.getColumn('F').width = TEMPLATE_CONFIG.columnWidths.F;
    ws.getColumn('G').width = TEMPLATE_CONFIG.columnWidths.G;
    ws.getColumn('H').width = TEMPLATE_CONFIG.columnWidths.H;
    ws.getColumn('I').width = TEMPLATE_CONFIG.columnWidths.I;
    ws.getColumn('J').width = TEMPLATE_CONFIG.columnWidths.J;

    // Parse cooking method
    let cookingSteps: { process: string; manual: string; translatedManual?: string; pngFilename?: string }[] = [];
    if (manual.cookingMethod) {
      try {
        const parsed = typeof manual.cookingMethod === 'string' 
          ? JSON.parse(manual.cookingMethod) 
          : manual.cookingMethod;
        if (Array.isArray(parsed)) {
          cookingSteps = parsed.map((step: any, idx: number) => {
            let process = String(step.process || '');
            let pngFilename = step.pngFilename || PROCESS_ICONS[process] || null;
            
            // Infer process from manual text if needed
            if (!process || process === 'Process' || process.startsWith('Process ')) {
              const manualText = String(step.manual || step.translatedManual || '').toLowerCase();
              
              if (manualText.includes('prepare') || manualText.includes('wash') || manualText.includes('chop')) {
                process = 'Ingredients Preparation';
              } else if (manualText.includes('marinate') || manualText.includes('marination')) {
                process = 'Marination';
              } else if (manualText.includes('batter mix') || manualText.includes('battering powder')) {
                process = 'Batter Mix Solution';
              } else if (manualText.includes('batter') || manualText.includes('coating')) {
                process = 'Battering';
              } else if (manualText.includes('fry') || manualText.includes('deep fry')) {
                process = 'Frying';
              } else if (manualText.includes('grill')) {
                process = 'Grill';
              } else if (manualText.includes('saute') || manualText.includes('sauté')) {
                process = 'Saute';
              } else if (manualText.includes('serve') || manualText.includes('serving')) {
                process = 'Serving';
              } else if (manualText.includes('assemble') || manualText.includes('plate')) {
                process = 'Assembling';
              } else if (manualText.includes('brush') && manualText.includes('sauce')) {
                process = 'Brushing Sauce';
              } else if (manualText.includes('season') || manualText.includes('toss')) {
                process = 'Seasoning Toss';
              } else if (manualText.includes('cook') || manualText.includes('heat')) {
                process = 'Cooking';
              }
              
              if (process && process !== 'Process') {
                const match = matchProcessPng(process, DEFAULT_PROCESS_ASSET_INDEX);
                pngFilename = match.filename || PROCESS_ICONS[process] || pngFilename;
              }
            }
            
            return {
              process: process || `Step ${idx + 1}`,
              manual: String(step.manual || step.translatedManual || ''),
              translatedManual: String(step.translatedManual || step.manual || ''),
              pngFilename: pngFilename
            };
          });
        }
      } catch {
        cookingSteps = [{ process: 'Process', manual: String(manual.cookingMethod) }];
      }
    }

    // ===== ROW 1: Title =====
    ws.mergeCells('B1:J1');
    ws.getCell('B1').value = 'Manual(Kitchen)';
    ws.getCell('B1').font = FONTS.title;
    ws.getCell('B1').alignment = { vertical: 'middle' };
    ws.getCell('B1').border = { top: mediumBorder, left: mediumBorder, right: mediumBorder, bottom: thinBorder };
    ws.getRow(1).height = TEMPLATE_CONFIG.rowHeights.title;

    // ===== ROW 2: Name =====
    ws.getCell('B2').value = 'Name';
    ws.getCell('B2').font = FONTS.menuName;
    ws.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('B2').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('B2').border = { top: thinBorder, left: mediumBorder, bottom: thinBorder, right: thinBorder };
    
    ws.mergeCells('C2:J2');
    ws.getCell('C2').value = manual.name;
    ws.getCell('C2').font = FONTS.menuName;
    ws.getCell('C2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('C2').alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getCell('C2').border = { top: thinBorder, bottom: thinBorder };
    ws.getCell('J2').border = { top: thinBorder, right: mediumBorder, bottom: thinBorder };
    ws.getRow(2).height = TEMPLATE_CONFIG.rowHeights.title;

    // ===== ROWS 3-11: Picture Area (height 22.5 each = 픽셀 30) =====
    for (let r = 3; r <= 11; r++) {
      ws.getRow(r).height = TEMPLATE_CONFIG.rowHeights.picture; // 22.5
    }

    ws.mergeCells('B3:B11'); // Picture label
    ws.getCell('B3').value = 'Picture';
    ws.getCell('B3').font = FONTS.pictureLabel;
    ws.getCell('B3').alignment = { horizontal: 'center', vertical: 'middle' };
    // B3:B11 병합셀 테두리 - 모든 행에 적용
    for (let r = 3; r <= 11; r++) {
      ws.getCell(`B${r}`).border = { left: mediumBorder, right: thinBorder };
    }

    // Picture area C3:H11 (merged for image)
    ws.mergeCells('C3:H11');
    ws.getCell('C3').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('C3').border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

    // Item List area
    ws.mergeCells('I3:J3');
    ws.getCell('I3').value = 'Item List';
    ws.getCell('I3').font = FONTS.pictureLabel;
    ws.getCell('I3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.whiteBg } };
    ws.getCell('I3').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('I3').border = { top: thinBorder, right: mediumBorder };

    ws.mergeCells('I4:J10');
    ws.getCell('I4').border = { left: thinBorder, right: mediumBorder };

    for (let r = 3; r <= 11; r++) {
      ws.getCell(`J${r}`).border = { right: mediumBorder };
    }
    ws.getCell('B11').border = { left: mediumBorder, bottom: thinBorder };
    ws.getCell('H11').border = { right: thinBorder, bottom: thinBorder };
    ws.getCell('I11').border = { left: thinBorder };
    ws.getCell('J11').border = { right: mediumBorder };

    // Add product image if available
    if (manual.imageUrl && manual.imageUrl.length > 0) {
      try {
        let imageBase64 = '';
        let imageExtension: 'png' | 'jpeg' | 'gif' = 'png';
        
        if (manual.imageUrl.startsWith('data:image/')) {
          const matches = manual.imageUrl.match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/);
          if (matches) {
            imageExtension = matches[1] === 'jpg' ? 'jpeg' : matches[1] as 'png' | 'jpeg' | 'gif';
            imageBase64 = matches[2];
          }
        } else if (manual.imageUrl.startsWith('http')) {
          const imgResponse = await fetch(manual.imageUrl);
          if (imgResponse.ok) {
            const imgBuffer = await imgResponse.arrayBuffer();
            imageBase64 = Buffer.from(imgBuffer).toString('base64');
            const contentType = imgResponse.headers.get('content-type') || '';
            if (contentType.includes('jpeg') || contentType.includes('jpg')) imageExtension = 'jpeg';
            else if (contentType.includes('gif')) imageExtension = 'gif';
          }
        }
        
        if (imageBase64) {
          const imageId = workbook.addImage({
            base64: imageBase64,
            extension: imageExtension
          });
          
          // C3:H11 position - 더 오른쪽 위로 조정
          // Max: 11cm width, 6.8cm height, maintain aspect ratio
          ws.addImage(imageId, {
            tl: { col: 2.3, row: 2.2 }, // C3 position, slightly right and up
            ext: { 
              width: TEMPLATE_CONFIG.picture.maxWidthPx, 
              height: TEMPLATE_CONFIG.picture.maxHeightPx 
            }
          });
        }
      } catch (imgError) {
        console.warn('Could not add product image:', imgError);
        ws.getCell('C3').value = '[No Image]';
      }
    } else {
      ws.getCell('C3').value = '[No Image]';
    }

    // ===== ROW 12: Ingredients Header =====
    ws.mergeCells('B12:B28');
    ws.getCell('B12').value = 'Ingredients \nComposition';
    ws.getCell('B12').font = FONTS.ingredientLabel;
    ws.getCell('B12').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws.getCell('B12').border = { left: mediumBorder };
    
    ws.getCell('C12').value = 'No.';
    ws.getCell('C12').font = FONTS.ingredientHeader;
    ws.getCell('C12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('C12').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('C12').border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

    ws.mergeCells('D12:E12');
    ws.getCell('D12').value = 'Ingredients';
    ws.getCell('D12').font = FONTS.ingredientHeader;
    ws.getCell('D12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('D12').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('D12').border = { top: thinBorder, left: thinBorder, bottom: thinBorder };
    ws.getCell('E12').border = { top: thinBorder, bottom: thinBorder, right: thinBorder };

    ws.getCell('F12').value = 'Weight';
    ws.getCell('F12').font = FONTS.ingredientHeader;
    ws.getCell('F12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('F12').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('F12').border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

    ws.getCell('G12').value = 'Unit';
    ws.getCell('G12').font = FONTS.ingredientHeader;
    ws.getCell('G12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('G12').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('G12').border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

    ws.getCell('H12').value = 'Purchase';
    ws.getCell('H12').font = FONTS.ingredientHeader;
    ws.getCell('H12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('H12').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('H12').border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

    ws.mergeCells('I12:J12');
    ws.getCell('I12').value = 'Others';
    ws.getCell('I12').font = FONTS.ingredientHeader;
    ws.getCell('I12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('I12').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('I12').border = { top: thinBorder, left: thinBorder, bottom: thinBorder };
    ws.getCell('J12').border = { top: thinBorder, bottom: thinBorder, right: mediumBorder };
    ws.getRow(12).height = TEMPLATE_CONFIG.rowHeights.ingredientHeader;

    // ===== ROWS 13-28: Ingredients Data =====
    const maxIngredients = 16;
    for (let i = 0; i < maxIngredients; i++) {
      const rowNum = 13 + i;
      const ingredient = manual.ingredients[i];
      const isLastRow = i === maxIngredients - 1;
      
      ws.getRow(rowNum).height = TEMPLATE_CONFIG.rowHeights.ingredient;
      
      ws.getCell(`C${rowNum}`).value = i + 1;
      ws.getCell(`C${rowNum}`).font = FONTS.content;
      ws.getCell(`C${rowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(`C${rowNum}`).border = {
        top: thinBorder, left: thinBorder,
        bottom: isLastRow ? mediumBorder : thinBorder, right: thinBorder,
      };

      ws.mergeCells(`D${rowNum}:E${rowNum}`);
      ws.getCell(`D${rowNum}`).value = ingredient?.name || '';
      ws.getCell(`D${rowNum}`).font = FONTS.content;
      ws.getCell(`D${rowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(`D${rowNum}`).border = {
        top: thinBorder, left: thinBorder,
        bottom: isLastRow ? mediumBorder : thinBorder,
      };
      ws.getCell(`E${rowNum}`).border = {
        top: thinBorder, right: thinBorder,
        bottom: isLastRow ? mediumBorder : thinBorder,
      };

      ws.getCell(`F${rowNum}`).value = ingredient?.quantity || '';
      ws.getCell(`F${rowNum}`).font = FONTS.content;
      ws.getCell(`F${rowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(`F${rowNum}`).border = {
        top: thinBorder, left: thinBorder,
        bottom: isLastRow ? mediumBorder : thinBorder, right: thinBorder,
      };

      ws.getCell(`G${rowNum}`).value = ingredient?.unit || '';
      ws.getCell(`G${rowNum}`).font = FONTS.content;
      ws.getCell(`G${rowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(`G${rowNum}`).border = {
        top: thinBorder, left: thinBorder,
        bottom: isLastRow ? mediumBorder : thinBorder, right: thinBorder,
      };

      ws.getCell(`H${rowNum}`).value = ingredient ? 'HQ' : '';
      ws.getCell(`H${rowNum}`).font = FONTS.content;
      ws.getCell(`H${rowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(`H${rowNum}`).border = {
        top: thinBorder, left: thinBorder,
        bottom: isLastRow ? mediumBorder : thinBorder, right: thinBorder,
      };

      ws.mergeCells(`I${rowNum}:J${rowNum}`);
      ws.getCell(`I${rowNum}`).value = ingredient?.notes || (ingredient ? 'Local' : '');
      ws.getCell(`I${rowNum}`).font = FONTS.content;
      ws.getCell(`I${rowNum}`).alignment = { horizontal: 'center' };
      ws.getCell(`I${rowNum}`).border = {
        top: thinBorder, left: thinBorder,
        bottom: isLastRow ? mediumBorder : thinBorder,
      };
      ws.getCell(`J${rowNum}`).border = {
        top: thinBorder, right: mediumBorder,
        bottom: isLastRow ? mediumBorder : thinBorder,
      };
    }

    ws.getCell('B28').border = { left: mediumBorder, bottom: mediumBorder };

    // ===== ROW 29: BBQ CANADA =====
    ws.mergeCells('B29:J29');
    ws.getCell('B29').value = 'BBQ CANADA';
    ws.getCell('B29').font = FONTS.small;
    ws.getCell('B29').alignment = { horizontal: 'right' };
    ws.getCell('B29').border = { left: mediumBorder, right: mediumBorder };
    ws.getRow(29).height = TEMPLATE_CONFIG.rowHeights.bbqCanada;

    // ===== ROW 30: COOKING METHOD Header =====
    ws.mergeCells('B30:J30');
    ws.getCell('B30').value = 'COOKING METHOD';
    ws.getCell('B30').font = FONTS.sectionHeader;
    ws.getCell('B30').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('B30').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('B30').border = { top: mediumBorder, left: mediumBorder, right: mediumBorder, bottom: mediumBorder };
    ws.getRow(30).height = TEMPLATE_CONFIG.rowHeights.cookingHeader;

    // ===== ROW 31: PROCESS / MANUAL headers =====
    ws.mergeCells('B31:D31');
    ws.getCell('B31').value = 'PROCESS';
    ws.getCell('B31').font = FONTS.ingredientHeader;
    ws.getCell('B31').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('B31').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('B31').border = { top: mediumBorder, left: mediumBorder, bottom: mediumBorder };
    ws.getCell('D31').border = { top: mediumBorder, right: thinBorder, bottom: mediumBorder };

    ws.mergeCells('E31:J31');
    ws.getCell('E31').value = 'MANUAL';
    ws.getCell('E31').font = FONTS.ingredientHeader;
    ws.getCell('E31').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('E31').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('E31').border = { top: mediumBorder, left: thinBorder, bottom: mediumBorder };
    ws.getCell('J31').border = { top: mediumBorder, right: mediumBorder, bottom: mediumBorder };
    ws.getRow(31).height = TEMPLATE_CONFIG.rowHeights.cookingSubHeader;

    // ===== ROWS 32+: Cooking Method Content =====
    // Process PNG icons path
    const iconBasePath = path.join(process.cwd(), 'public', 'process-png');
    
    // Build cooking content with blank rows between processes
    interface CookingRow {
      type: 'content' | 'blank';
      processName?: string;
      pngFilename?: string;
      manualLine?: string;
      isFirstOfProcess?: boolean;
    }
    
    const cookingRows: CookingRow[] = [];
    
    for (let stepIdx = 0; stepIdx < cookingSteps.length; stepIdx++) {
      const step = cookingSteps[stepIdx];
      const manualLines = (step.translatedManual || step.manual || '').split('\n').filter(l => l.trim());
      
      // Add each line of manual
      manualLines.forEach((line, lineIdx) => {
        cookingRows.push({
          type: 'content',
          processName: step.process,
          pngFilename: step.pngFilename,
          manualLine: line,
          isFirstOfProcess: lineIdx === 0,
        });
      });
      
      // Add blank row after each process (except last)
      if (stepIdx < cookingSteps.length - 1) {
        cookingRows.push({ type: 'blank' });
      }
    }
    
    // Now render cooking rows starting from row 32
    const COOKING_START_ROW = 32;
    const COOKING_END_ROW = 61;
    
    // Merge B32:D61 for PROCESS column (single merged cell for all process icons)
    ws.mergeCells('B32:D61');
    ws.getCell('B32').alignment = { horizontal: 'center', vertical: 'top' };
    
    // Set row heights and borders
    for (let r = COOKING_START_ROW; r <= COOKING_END_ROW; r++) {
      ws.getRow(r).height = TEMPLATE_CONFIG.rowHeights.cookingRow;
      // B 열 왼쪽 굵은 테두리
      ws.getCell(`B${r}`).border = { left: mediumBorder };
      // D 열 오른쪽 얀은 테두리
      ws.getCell(`D${r}`).border = { right: thinBorder };
      // J 열 오른쪽 굵은 테두리
      ws.getCell(`J${r}`).border = { right: mediumBorder };
    }
    
    // B32:D61 왼쪽 테두리 유지 (병합 후에도)
    ws.getCell('B32').border = { left: mediumBorder };
    
    // Track which row each process starts at for PNG placement
    const processStartRows: { process: string; pngFilename?: string; startRow: number }[] = [];
    let lastProcess = '';
    
    // Fill in cooking content
    for (let i = 0; i < cookingRows.length && (COOKING_START_ROW + i) <= COOKING_END_ROW; i++) {
      const row = cookingRows[i];
      const rowNum = COOKING_START_ROW + i;
      
      // Merge E:J for manual text
      ws.mergeCells(`E${rowNum}:J${rowNum}`);
      
      if (row.type === 'content') {
        ws.getCell(`E${rowNum}`).value = row.manualLine;
        ws.getCell(`E${rowNum}`).font = FONTS.content;
        ws.getCell(`E${rowNum}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        
        // Track process start for PNG
        if (row.isFirstOfProcess && row.processName && row.processName !== lastProcess) {
          processStartRows.push({
            process: row.processName,
            pngFilename: row.pngFilename,
            startRow: rowNum,
          });
          lastProcess = row.processName;
        }
      }
      // Blank rows are left empty (for process separation)
    }
    
    // Bottom border for row 61 - 하단 굵은 테두리
    for (let c = 2; c <= 10; c++) {
      const cell = ws.getCell(61, c);
      const isFirst = c === 2;
      const isLast = c === 10;
      cell.border = { 
        left: isFirst ? mediumBorder : undefined,
        right: isLast ? mediumBorder : (c === 4 ? thinBorder : undefined),
        bottom: mediumBorder 
      };
    }
    
    // Add PNG icons for each process at their start rows
    // PNG top edge aligns with the start row of each process
    for (const proc of processStartRows) {
      const pngFilename = proc.pngFilename || PROCESS_ICONS[proc.process];
      if (pngFilename) {
        const iconPath = path.join(iconBasePath, pngFilename);
        if (fs.existsSync(iconPath)) {
          try {
            const imageData = fs.readFileSync(iconPath);
            const base64Image = imageData.toString('base64');
            const imageId = workbook.addImage({ 
              base64: base64Image, 
              extension: 'png' 
            });
            
            // Place PNG with top edge at the start row
            // B:D columns (col 1-3), top aligned to start row
            // 0-indexed: col 1 = B, row is rowNum - 1
            ws.addImage(imageId, {
              tl: { col: 1.1, row: proc.startRow - 1 }, // Top-left at B{startRow}
              ext: { 
                width: TEMPLATE_CONFIG.pngIcon.widthPx, 
                height: TEMPLATE_CONFIG.pngIcon.heightPx 
              },
            });
          } catch (imgError) {
            console.warn(`Could not add process image ${pngFilename}:`, imgError);
          }
        }
      }
    }

    // ===== ROW 62: BBQ CANADA =====
    ws.mergeCells('B62:J62');
    ws.getCell('B62').value = 'BBQ CANADA';
    ws.getCell('B62').font = FONTS.small;
    ws.getCell('B62').alignment = { horizontal: 'right' };
    ws.getRow(62).height = TEMPLATE_CONFIG.rowHeights.bbqCanada;
    
    // B62:J62 모든 셀에 테두리 적용
    for (let c = 2; c <= 10; c++) {
      const cell = ws.getCell(62, c);
      const isFirst = c === 2;
      const isLast = c === 10;
      cell.border = { 
        left: isFirst ? mediumBorder : undefined,
        right: isLast ? mediumBorder : undefined,
        bottom: mediumBorder 
      };
    }

    // Add page breaks
    ws.getRow(29).addPageBreak();
    ws.getRow(62).addPageBreak();

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Return Excel file
    const filename = `${manual.name || 'manual'}_template.xlsx`;
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error('Export template error:', error);
    return NextResponse.json({ error: 'Failed to export template' }, { status: 500 });
  }
}
