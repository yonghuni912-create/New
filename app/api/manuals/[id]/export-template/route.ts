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

// Template Configuration - 목표 템플릿 기준 (Target Template Style)
const TEMPLATE_CONFIG = {
  // Column widths (based on target template analysis)
  columnWidths: {
    A: 3,       // Margin
    B: 14.14,   // Manual(Kitchen), Name labels
    C: 5.57,    // No. (ingredient number)
    D: 6.29,    // Ingredient name merge start
    E: 28.43,   // Ingredient name / Manual content
    F: 6.57,    // Weight
    G: 5.57,    // Unit
    H: 10.43,   // Purchase
    I: 6,       // Others start
    J: 19.43,   // Others end / Item List
  },
  // Row heights
  rowHeights: {
    title: 28.5,         // Row 1, 2
    picture: 22.5,       // Rows 3-11
    ingredientHeader: 18,// Row 12
    ingredient: 21,      // Rows 13-28
    bbqCanada: 15,       // BBQ CANADA row
    cookingHeader: 28,   // COOKING METHOD header
    cookingSubHeader: 18,// PROCESS/MANUAL row
  },
};

// Font styles - 목표 템플릿 기준 (Calibri font, proper colors)
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
  grayBg: 'FFBFBFBF',    // Gray background for headers (target template)
  whiteBg: 'FFFFFFFF',    // White background
  black: 'FF000000',
};

// Border styles
const BORDERS = {
  thick: { style: 'medium' as const, color: { argb: 'FF000000' } },
  thin: { style: 'thin' as const, color: { argb: 'FF000000' } },
  light: { style: 'thin' as const, color: { argb: 'FFE0E0E0' } },
  double: { style: 'double' as const, color: { argb: 'FF000000' } },
};

// Helper to create border object
const border = (style: ExcelJS.BorderStyle) => ({ style, color: { argb: COLORS.black } });
const mediumBorder = border('medium');
const thinBorder = border('thin');

// Process icon mapping - for PNG insertion (matching actual files in 'process png' folder)
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

// Helper function to apply border to a cell
const applyBorder = (cell: ExcelJS.Cell, top?: typeof BORDERS.thick, right?: typeof BORDERS.thick, bottom?: typeof BORDERS.thick, left?: typeof BORDERS.thick) => {
  cell.border = {
    top: top || undefined,
    right: right || undefined,
    bottom: bottom || undefined,
    left: left || undefined,
  };
};

// Helper function to apply border to merged cells range
const applyBorderToRange = (worksheet: ExcelJS.Worksheet, startCell: string, endCell: string, borderStyle: typeof BORDERS.thick) => {
  const start = worksheet.getCell(startCell);
  const end = worksheet.getCell(endCell);
  const startCol = Number(start.col);
  const endCol = Number(end.col);
  const startRow = Number(start.row);
  const endRow = Number(end.row);
  
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const cell = worksheet.getCell(row, col);
      cell.border = {
        top: row === startRow ? borderStyle : undefined,
        bottom: row === endRow ? borderStyle : undefined,
        left: col === startCol ? borderStyle : undefined,
        right: col === endCol ? borderStyle : undefined,
      };
    }
  }
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

    // Build manual object with proper string types
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

    // Set column widths directly from config (already in Excel units)
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

    // Parse cooking method for PNG insertion
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
            
            // If process is empty or generic, try to infer from manual text
            if (!process || process === 'Process' || process.startsWith('Process ')) {
              const manualText = String(step.manual || step.translatedManual || '').toLowerCase();
              
              // Try to infer process type from manual content
              if (manualText.includes('prepare') || manualText.includes('wash') || manualText.includes('chop') || manualText.includes('slice') || manualText.includes('cut')) {
                process = 'Ingredients Preparation';
              } else if (manualText.includes('marinate') || manualText.includes('marination')) {
                process = 'Marination';
              } else if (manualText.includes('batter') || manualText.includes('coating')) {
                process = 'Battering';
              } else if (manualText.includes('fry') || manualText.includes('deep fry') || manualText.includes('frying')) {
                process = 'Frying';
              } else if (manualText.includes('grill') || manualText.includes('grilling')) {
                process = 'Grill';
              } else if (manualText.includes('saute') || manualText.includes('sauté') || manualText.includes('pan fry')) {
                process = 'Saute';
              } else if (manualText.includes('serve') || manualText.includes('customer') || manualText.includes('serving')) {
                process = 'Serving';
              } else if (manualText.includes('assemble') || manualText.includes('plate') || manualText.includes('put on')) {
                process = 'Assembling';
              } else if (manualText.includes('sauce') && manualText.includes('mix')) {
                process = 'Sauce Mix';
              } else if (manualText.includes('brush') && manualText.includes('sauce')) {
                process = 'Brushing Sauce';
              } else if (manualText.includes('season') || manualText.includes('toss')) {
                process = 'Seasoning Toss';
              } else if (manualText.includes('cook') || manualText.includes('heat')) {
                process = 'Cooking';
              }
              
              // Try matchProcessPng for better matching
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

    // ===== PAGE 1: Title, Picture, Ingredients =====
    
    // Row 1: Manual(Kitchen) Title - NO background color per target template
    ws.mergeCells('B1:J1');
    ws.getCell('B1').value = 'Manual(Kitchen)';
    ws.getCell('B1').font = FONTS.title;
    ws.getCell('B1').alignment = { vertical: 'middle' }; // Left-aligned, vertical middle
    ws.getCell('B1').border = {
      top: mediumBorder,
      left: mediumBorder,
      right: mediumBorder,
      bottom: thinBorder,
    };
    ws.getRow(1).height = TEMPLATE_CONFIG.rowHeights.title;

    // Row 2: Name + Menu Name with Gray background
    ws.getCell('B2').value = 'Name';
    ws.getCell('B2').font = FONTS.menuName;
    ws.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('B2').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('B2').border = {
      top: thinBorder,
      left: mediumBorder,
      bottom: thinBorder,
      right: thinBorder,
    };
    
    ws.mergeCells('C2:J2');
    ws.getCell('C2').value = manual.name;
    ws.getCell('C2').font = FONTS.menuName;
    ws.getCell('C2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('C2').alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getCell('C2').border = { top: thinBorder, bottom: thinBorder };
    ws.getCell('J2').border = { top: thinBorder, right: mediumBorder, bottom: thinBorder };
    ws.getRow(2).height = TEMPLATE_CONFIG.rowHeights.title;

    // Rows 3-11: Picture area
    ws.mergeCells('B3:B11'); // Picture label vertically merged
    ws.getCell('B3').value = 'Picture';
    ws.getCell('B3').font = FONTS.pictureLabel;
    ws.getCell('B3').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('B3').border = { left: mediumBorder };

    ws.mergeCells('C3:H11');
    ws.getCell('C3').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('C3').border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

    // Add product image if available
    let productImageAdded = false;
    if (manual.imageUrl && manual.imageUrl.length > 0) {
      try {
        let imageBase64 = '';
        let imageExtension: 'png' | 'jpeg' | 'gif' = 'png';
        
        if (manual.imageUrl.startsWith('data:image/')) {
          // Extract base64 from data URL
          const matches = manual.imageUrl.match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/);
          if (matches) {
            imageExtension = matches[1] === 'jpg' ? 'jpeg' : matches[1] as 'png' | 'jpeg' | 'gif';
            imageBase64 = matches[2];
          }
        } else if (manual.imageUrl.startsWith('http')) {
          // Fetch image from URL
          const imgResponse = await fetch(manual.imageUrl);
          if (imgResponse.ok) {
            const imgBuffer = await imgResponse.arrayBuffer();
            imageBase64 = Buffer.from(imgBuffer).toString('base64');
            const contentType = imgResponse.headers.get('content-type') || '';
            if (contentType.includes('jpeg') || contentType.includes('jpg')) {
              imageExtension = 'jpeg';
            } else if (contentType.includes('gif')) {
              imageExtension = 'gif';
            }
          }
        }
        
        if (imageBase64) {
          const imageId = workbook.addImage({
            base64: imageBase64,
            extension: imageExtension
          });
          
          // Place image in Picture area (C3:H11) - approximate position
          ws.addImage(imageId, {
            tl: { col: 2.1, row: 2.1 }, // C3 position (0-indexed)
            ext: { width: 280, height: 200 } // Size in pixels
          });
          productImageAdded = true;
        }
      } catch (imgError) {
        console.warn('Could not add product image:', imgError);
      }
    }
    
    // Show placeholder text only if no image was added
    if (!productImageAdded) {
      ws.getCell('C3').value = '[No Image]';
    }

    ws.mergeCells('I3:J3');
    ws.getCell('I3').value = 'Item List';
    ws.getCell('I3').font = { ...FONTS.pictureLabel, color: { argb: COLORS.black } };
    ws.getCell('I3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.whiteBg } };
    ws.getCell('I3').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('I3').border = { top: thinBorder, right: mediumBorder };

    for (let r = 3; r <= 11; r++) {
      ws.getRow(r).height = TEMPLATE_CONFIG.rowHeights.picture;
      ws.getCell(`J${r}`).border = { right: mediumBorder };
    }

    ws.mergeCells('I4:J10');
    ws.getCell('I4').border = { left: thinBorder, right: mediumBorder };
    ws.getCell('I11').border = { left: thinBorder };
    ws.getCell('J11').border = { right: mediumBorder };
    ws.getCell('B11').border = { left: mediumBorder, bottom: thinBorder };
    ws.getCell('H11').border = { right: thinBorder, bottom: thinBorder };

    // Row 12: Ingredients Header - B12 merged vertically with B13:B28
    ws.mergeCells('B12:B28');
    ws.getCell('B12').value = 'Ingredients \nComposition';
    ws.getCell('B12').font = FONTS.ingredientLabel;
    ws.getCell('B12').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws.getCell('B12').border = { left: mediumBorder };
    
    // Header row 12
    ws.getCell('C12').value = 'No.';
    ws.getCell('C12').font = FONTS.ingredientHeader;
    ws.getCell('C12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('C12').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('C12').border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

    // D12:E12 merged for "Ingredients"
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
    ws.getCell('F12').alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
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

    // I12:J12 merged for "Others"
    ws.mergeCells('I12:J12');
    ws.getCell('I12').value = 'Others';
    ws.getCell('I12').font = FONTS.ingredientHeader;
    ws.getCell('I12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('I12').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('I12').border = { top: thinBorder, left: thinBorder, bottom: thinBorder };
    ws.getCell('J12').border = { top: thinBorder, bottom: thinBorder, right: mediumBorder };
    ws.getRow(12).height = TEMPLATE_CONFIG.rowHeights.ingredientHeader;

    // Rows 13-28: Ingredients Data (16 rows)
    const maxIngredients = 16;
    for (let i = 0; i < maxIngredients; i++) {
      const rowNum = 13 + i;
      const ingredient = manual.ingredients[i];
      const isLastRow = i === maxIngredients - 1;
      
      ws.getRow(rowNum).height = TEMPLATE_CONFIG.rowHeights.ingredient;
      
      // No. column
      ws.getCell(`C${rowNum}`).value = i + 1;
      ws.getCell(`C${rowNum}`).font = FONTS.content;
      ws.getCell(`C${rowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.whiteBg } };
      ws.getCell(`C${rowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(`C${rowNum}`).border = {
        top: thinBorder,
        left: thinBorder,
        bottom: isLastRow ? mediumBorder : thinBorder,
        right: thinBorder,
      };

      // Ingredients D:E merged
      ws.mergeCells(`D${rowNum}:E${rowNum}`);
      ws.getCell(`D${rowNum}`).value = ingredient?.name || '';
      ws.getCell(`D${rowNum}`).font = FONTS.content;
      ws.getCell(`D${rowNum}`).alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
      ws.getCell(`D${rowNum}`).border = {
        top: thinBorder,
        left: thinBorder,
        bottom: isLastRow ? mediumBorder : thinBorder,
      };
      ws.getCell(`E${rowNum}`).border = {
        top: thinBorder,
        right: thinBorder,
        bottom: isLastRow ? mediumBorder : thinBorder,
      };

      // Weight
      ws.getCell(`F${rowNum}`).value = ingredient?.quantity || '';
      ws.getCell(`F${rowNum}`).font = FONTS.content;
      ws.getCell(`F${rowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(`F${rowNum}`).border = {
        top: thinBorder,
        left: thinBorder,
        bottom: isLastRow ? mediumBorder : thinBorder,
        right: thinBorder,
      };

      // Unit
      ws.getCell(`G${rowNum}`).value = ingredient?.unit || '';
      ws.getCell(`G${rowNum}`).font = FONTS.content;
      ws.getCell(`G${rowNum}`).alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
      ws.getCell(`G${rowNum}`).border = {
        top: thinBorder,
        left: thinBorder,
        bottom: isLastRow ? mediumBorder : thinBorder,
        right: thinBorder,
      };

      // Purchase
      ws.getCell(`H${rowNum}`).value = ingredient ? 'HQ' : '';
      ws.getCell(`H${rowNum}`).font = FONTS.content;
      ws.getCell(`H${rowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(`H${rowNum}`).border = {
        top: thinBorder,
        left: thinBorder,
        bottom: isLastRow ? mediumBorder : thinBorder,
        right: thinBorder,
      };

      // Others I:J merged
      ws.mergeCells(`I${rowNum}:J${rowNum}`);
      ws.getCell(`I${rowNum}`).value = ingredient?.notes || '';
      ws.getCell(`I${rowNum}`).font = FONTS.content;
      ws.getCell(`I${rowNum}`).alignment = { horizontal: 'center' };
      ws.getCell(`I${rowNum}`).border = {
        top: thinBorder,
        left: thinBorder,
        bottom: isLastRow ? mediumBorder : thinBorder,
      };
      ws.getCell(`J${rowNum}`).border = {
        top: thinBorder,
        right: mediumBorder,
        bottom: isLastRow ? mediumBorder : thinBorder,
      };
    }

    // B28 bottom border
    ws.getCell('B28').border = { left: mediumBorder, bottom: mediumBorder };

    // Row 29: BBQ CANADA - Right aligned
    ws.mergeCells('B29:J29');
    ws.getCell('B29').value = 'BBQ CANADA';
    ws.getCell('B29').font = FONTS.small;
    ws.getCell('B29').alignment = { horizontal: 'right' };
    ws.getCell('B29').border = { left: mediumBorder, right: mediumBorder };
    ws.getRow(29).height = TEMPLATE_CONFIG.rowHeights.bbqCanada;

    // ===== PAGE 2: COOKING METHOD =====
    
    // Row 30: COOKING METHOD Header with Gray background (not orange)
    ws.mergeCells('B30:J30');
    ws.getCell('B30').value = 'COOKING METHOD';
    ws.getCell('B30').font = FONTS.sectionHeader;
    ws.getCell('B30').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayBg } };
    ws.getCell('B30').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('B30').border = {
      top: mediumBorder,
      left: mediumBorder,
      right: mediumBorder,
      bottom: mediumBorder,
    };
    ws.getRow(30).height = TEMPLATE_CONFIG.rowHeights.cookingHeader;

    // Row 31: PROCESS / MANUAL headers
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

    // Rows 32-61: Cooking Method Content (30 rows)
    // Dynamic row allocation based on manual text length
    // Process box has thin border, no border between processes
    
    const COOKING_START_ROW = 32;
    const COOKING_END_ROW = 61;
    const TOTAL_ROWS = COOKING_END_ROW - COOKING_START_ROW + 1; // 30 rows
    const MIN_ROWS_PER_STEP = 3; // Minimum rows for PNG icon
    
    // Process PNG icons path - use 'public/process-png' folder
    const iconBasePath = path.join(process.cwd(), 'public', 'process-png');
    
    // Calculate rows needed for each step based on text length
    const calculateRowsForStep = (text: string): number => {
      if (!text) return MIN_ROWS_PER_STEP;
      const lines = text.split('\n').length;
      // Approximate: 2 lines per row, minimum 3 rows
      return Math.max(MIN_ROWS_PER_STEP, Math.ceil(lines / 2) + 1);
    };
    
    // Calculate row allocation for all steps
    const stepRowCounts: number[] = cookingSteps.map(step => 
      calculateRowsForStep(step.translatedManual || step.manual || '')
    );
    const totalNeeded = stepRowCounts.reduce((a, b) => a + b, 0);
    
    // Adjust if total exceeds available rows
    let scaleFactor = 1;
    if (totalNeeded > TOTAL_ROWS && cookingSteps.length > 0) {
      scaleFactor = TOTAL_ROWS / totalNeeded;
    }
    
    // Initialize all rows with basic styling (no borders initially)
    for (let r = COOKING_START_ROW; r <= COOKING_END_ROW; r++) {
      ws.getRow(r).height = TEMPLATE_CONFIG.rowHeights.ingredient;
      // Only outer borders
      ws.getCell(`B${r}`).border = { left: mediumBorder };
      ws.getCell(`J${r}`).border = { right: mediumBorder };
    }
    
    // Insert cooking steps with dynamic row allocation
    let currentRow = COOKING_START_ROW;
    
    for (let stepIdx = 0; stepIdx < cookingSteps.length; stepIdx++) {
      const step = cookingSteps[stepIdx];
      const rowCount = Math.max(MIN_ROWS_PER_STEP, Math.floor(stepRowCounts[stepIdx] * scaleFactor));
      const startRow = currentRow;
      const endRow = Math.min(startRow + rowCount - 1, COOKING_END_ROW);
      
      if (startRow > COOKING_END_ROW) break;
      
      // Merge cells for this step's PROCESS area (B:D)
      if (endRow >= startRow) {
        ws.mergeCells(`B${startRow}:D${endRow}`);
        ws.getCell(`B${startRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
        
        // PROCESS box border - thin border around the box only
        // Top border (only for first step or after gap)
        ws.getCell(`B${startRow}`).border = { 
          left: mediumBorder, 
          top: thinBorder 
        };
        ws.getCell(`C${startRow}`).border = { top: thinBorder };
        ws.getCell(`D${startRow}`).border = { top: thinBorder, right: thinBorder };
        
        // Side borders for middle rows
        for (let r = startRow + 1; r < endRow; r++) {
          ws.getCell(`B${r}`).border = { left: mediumBorder };
          ws.getCell(`D${r}`).border = { right: thinBorder };
        }
        
        // Bottom border
        if (endRow > startRow) {
          ws.getCell(`B${endRow}`).border = { left: mediumBorder, bottom: thinBorder };
          ws.getCell(`C${endRow}`).border = { bottom: thinBorder };
          ws.getCell(`D${endRow}`).border = { right: thinBorder, bottom: thinBorder };
        } else {
          // Single row step
          ws.getCell(`B${startRow}`).border = { 
            left: mediumBorder, 
            top: thinBorder, 
            bottom: thinBorder 
          };
          ws.getCell(`C${startRow}`).border = { top: thinBorder, bottom: thinBorder };
          ws.getCell(`D${startRow}`).border = { 
            top: thinBorder, 
            right: thinBorder, 
            bottom: thinBorder 
          };
        }
        
        // Merge cells for this step's MANUAL area (E:J)
        ws.mergeCells(`E${startRow}:J${endRow}`);
        const manualText = step.translatedManual || step.manual || '';
        ws.getCell(`E${startRow}`).value = manualText;
        ws.getCell(`E${startRow}`).font = FONTS.content;
        ws.getCell(`E${startRow}`).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
        // MANUAL area - no left border (it's the PROCESS right border), only outer right
        ws.getCell(`J${startRow}`).border = { right: mediumBorder };
        for (let r = startRow + 1; r <= endRow; r++) {
          ws.getCell(`J${r}`).border = { right: mediumBorder };
        }
        
        // Insert PNG icon for this process
        const pngFilename = step.pngFilename || PROCESS_ICONS[step.process];
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
              // Place PNG centered in PROCESS cell area
              const rowMid = startRow + Math.floor((endRow - startRow) / 2);
              ws.addImage(imageId, {
                tl: { col: 1.2, row: rowMid - 1 + 0.1 },
                ext: { width: 75, height: 60 },
              });
            } catch (imgError) {
              console.warn(`Could not add process image ${pngFilename}:`, imgError);
              ws.getCell(`B${startRow}`).value = step.process;
              ws.getCell(`B${startRow}`).font = FONTS.content;
            }
          } else {
            ws.getCell(`B${startRow}`).value = step.process;
            ws.getCell(`B${startRow}`).font = FONTS.content;
          }
        } else {
          ws.getCell(`B${startRow}`).value = step.process;
          ws.getCell(`B${startRow}`).font = FONTS.content;
        }
      }
      
      currentRow = endRow + 1;
    }
    
    // Fill remaining empty rows with only outer borders
    for (let r = currentRow; r <= COOKING_END_ROW; r++) {
      ws.getCell(`B${r}`).border = { left: mediumBorder };
      ws.getCell(`J${r}`).border = { right: mediumBorder };
    }
    
    // Bottom border for entire section (row 61)
    ws.getCell('B61').border = { left: mediumBorder, bottom: mediumBorder };
    ws.getCell('C61').border = { bottom: mediumBorder };
    ws.getCell('D61').border = { bottom: mediumBorder };
    ws.getCell('E61').border = { bottom: mediumBorder };
    ws.getCell('F61').border = { bottom: mediumBorder };
    ws.getCell('G61').border = { bottom: mediumBorder };
    ws.getCell('H61').border = { bottom: mediumBorder };
    ws.getCell('I61').border = { bottom: mediumBorder };
    ws.getCell('J61').border = { right: mediumBorder, bottom: mediumBorder };

    // Row 62: BBQ CANADA
    ws.mergeCells('B62:J62');
    ws.getCell('B62').value = 'BBQ CANADA';
    ws.getCell('B62').font = FONTS.small;
    ws.getCell('B62').alignment = { horizontal: 'right' };
    ws.getCell('B62').border = { left: mediumBorder, right: mediumBorder };
    ws.getRow(62).height = TEMPLATE_CONFIG.rowHeights.bbqCanada;

    // Add page breaks for printing
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
