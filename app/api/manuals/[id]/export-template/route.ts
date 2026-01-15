import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

// Template Configuration based on user specifications
const TEMPLATE_CONFIG = {
  // Column widths in pixels (B-J columns, index 1-9)
  columnWidths: {
    B: 106,   // Manual(Kitchen), Name labels
    C: 42,    // No. (ingredient number)
    D: 47,    // Separator/margin
    E: 213,   // Main content (ingredient name, cooking method)
    F: 49,    // Weight
    G: 42,    // Unit
    H: 78,    // Purchase
    I: 45,    // Others
    J: 146,   // Picture, Item List
  },
  // Row heights in pixels
  rowHeights: {
    title: 38,        // Row 1, 2
    sectionHeader: 33, // Row 33, 66 (COOKING METHOD)
    content: 28,       // Standard content rows
    footer: 22,        // BBQ CANADA logo rows (32, 65, 98)
  },
  // Page boundaries
  pages: {
    page1: { start: 1, end: 32 },   // Title, Picture, Ingredients
    page2: { start: 33, end: 65 },  // Cooking Method (first part)
    page3: { start: 66, end: 98 },  // Cooking Method (continued)
  },
  // Cooking method area limits (rows available for content per page)
  cookingMethodRows: {
    page2: { start: 35, end: 64 },  // 30 rows for cooking content
    page3: { start: 68, end: 97 },  // 30 rows for cooking content
  },
  // Max characters per cooking method cell (approximate)
  maxCharsPerPage: 1000,
};

// Font styles
const FONTS = {
  title: { name: 'Arial', size: 20, bold: true },
  menuName: { name: 'Arial', size: 16, bold: true },
  sectionHeader: { name: 'Arial', size: 14, bold: true },
  content: { name: 'Arial', size: 11 },
  small: { name: 'Arial', size: 10 },
};

// Border styles
const BORDERS = {
  thick: { style: 'medium' as const, color: { argb: 'FF000000' } },
  thin: { style: 'thin' as const, color: { argb: 'FF000000' } },
  light: { style: 'thin' as const, color: { argb: 'FFE0E0E0' } },
  double: { style: 'double' as const, color: { argb: 'FF000000' } },
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

    // Fetch manual with ingredients
    const manual = await prisma.menuManual.findUnique({
      where: { id },
      include: {
        ingredients: {
          orderBy: { sortOrder: 'asc' },
          include: {
            ingredientMaster: true,
          },
        },
      },
    });

    if (!manual) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(manual.name || 'Manual');

    // Set column widths (convert pixels to Excel width units, ~7.5 pixels per unit)
    const pixelToWidth = (px: number) => px / 7.5;
    worksheet.getColumn('A').width = 3; // Small margin column
    worksheet.getColumn('B').width = pixelToWidth(TEMPLATE_CONFIG.columnWidths.B);
    worksheet.getColumn('C').width = pixelToWidth(TEMPLATE_CONFIG.columnWidths.C);
    worksheet.getColumn('D').width = pixelToWidth(TEMPLATE_CONFIG.columnWidths.D);
    worksheet.getColumn('E').width = pixelToWidth(TEMPLATE_CONFIG.columnWidths.E);
    worksheet.getColumn('F').width = pixelToWidth(TEMPLATE_CONFIG.columnWidths.F);
    worksheet.getColumn('G').width = pixelToWidth(TEMPLATE_CONFIG.columnWidths.G);
    worksheet.getColumn('H').width = pixelToWidth(TEMPLATE_CONFIG.columnWidths.H);
    worksheet.getColumn('I').width = pixelToWidth(TEMPLATE_CONFIG.columnWidths.I);
    worksheet.getColumn('J').width = pixelToWidth(TEMPLATE_CONFIG.columnWidths.J);

    // Helper function to set row height
    const setRowHeight = (row: number, height: number) => {
      worksheet.getRow(row).height = height * 0.75; // Convert pixels to points
    };

    // ===== PAGE 1: Title, Picture, Ingredients =====
    
    // Row 1: Title
    worksheet.mergeCells('B1:J1');
    const titleCell = worksheet.getCell('B1');
    titleCell.value = 'Manual(Kitchen)';
    titleCell.font = FONTS.title;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6600' } };
    titleCell.font = { ...FONTS.title, color: { argb: 'FFFFFFFF' } };
    titleCell.border = {
      top: BORDERS.thick,
      left: BORDERS.thick,
      right: BORDERS.thick,
      bottom: BORDERS.thin,
    };
    setRowHeight(1, TEMPLATE_CONFIG.rowHeights.title);

    // Row 2: Menu Name
    worksheet.getCell('B2').value = 'Name';
    worksheet.getCell('B2').font = FONTS.menuName;
    worksheet.getCell('B2').border = {
      left: BORDERS.thick,
      bottom: BORDERS.thin,
    };
    worksheet.mergeCells('C2:J2');
    worksheet.getCell('C2').value = manual.name;
    worksheet.getCell('C2').font = FONTS.menuName;
    worksheet.getCell('J2').border = {
      right: BORDERS.thick,
      bottom: BORDERS.thin,
    };
    setRowHeight(2, TEMPLATE_CONFIG.rowHeights.title);

    // Row 3: Picture label and Item List header
    worksheet.getCell('B3').value = 'Picture';
    worksheet.getCell('B3').font = FONTS.sectionHeader;
    worksheet.getCell('B3').border = { left: BORDERS.thick, top: BORDERS.thin };
    worksheet.getCell('I3').value = 'Item List';
    worksheet.getCell('I3').font = FONTS.sectionHeader;
    worksheet.mergeCells('I3:J3');
    worksheet.getCell('J3').border = { right: BORDERS.thick, top: BORDERS.thin };

    // Rows 4-11: Picture area (merged cells for image placeholder)
    worksheet.mergeCells('B4:H11');
    const pictureCell = worksheet.getCell('B4');
    pictureCell.value = '[No Image]'; // Turso schema doesn't have imageUrl
    pictureCell.alignment = { horizontal: 'center', vertical: 'middle' };
    pictureCell.border = {
      top: BORDERS.thick,
      left: BORDERS.thick,
      bottom: BORDERS.thick,
      right: BORDERS.thick,
    };
    // Apply thick border to picture area edges
    for (let row = 4; row <= 11; row++) {
      worksheet.getCell(`B${row}`).border = { 
        ...worksheet.getCell(`B${row}`).border, 
        left: BORDERS.thick 
      };
      worksheet.getCell(`H${row}`).border = { 
        ...worksheet.getCell(`H${row}`).border, 
        right: BORDERS.thin 
      };
      worksheet.getCell(`J${row}`).border = { 
        ...worksheet.getCell(`J${row}`).border, 
        right: BORDERS.thick 
      };
    }
    worksheet.getCell('B11').border = { left: BORDERS.thick, bottom: BORDERS.thick };
    worksheet.getCell('H11').border = { right: BORDERS.thin, bottom: BORDERS.thick };

    // Row 12: Ingredients Header
    worksheet.getCell('B12').value = 'Ingredients Composition';
    worksheet.getCell('B12').font = FONTS.sectionHeader;
    worksheet.getCell('B12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
    worksheet.getCell('B12').border = { left: BORDERS.thick, top: BORDERS.thin, bottom: BORDERS.thin };
    worksheet.mergeCells('B12:D12');
    
    // Header cells with borders
    const headerCells = [
      { cell: 'E12', value: 'No.' },
      { cell: 'F12', value: 'Ingredients' },
      { cell: 'G12', value: 'Weight' },
      { cell: 'H12', value: 'Unit' },
      { cell: 'I12', value: 'Purchase' },
      { cell: 'J12', value: 'Others' },
    ];
    headerCells.forEach(({ cell, value }) => {
      const c = worksheet.getCell(cell);
      c.value = value;
      c.font = { ...FONTS.content, bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      c.border = { 
        top: BORDERS.thin, 
        bottom: BORDERS.thin,
        left: BORDERS.light,
        right: cell === 'J12' ? BORDERS.thick : BORDERS.light,
      };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Rows 13-31: Ingredients (up to 19 items)
    const maxIngredients = 19;
    for (let i = 0; i < maxIngredients; i++) {
      const rowNum = 13 + i;
      const ingredient = manual.ingredients[i];
      const isLastRow = i === maxIngredients - 1;
      
      setRowHeight(rowNum, TEMPLATE_CONFIG.rowHeights.content);
      
      // Left border for B column
      worksheet.getCell(`B${rowNum}`).border = { left: BORDERS.thick };
      
      worksheet.getCell(`C${rowNum}`).value = i + 1;
      worksheet.getCell(`C${rowNum}`).alignment = { horizontal: 'center' };
      
      if (ingredient) {
        worksheet.getCell(`E${rowNum}`).value = ingredient.name || '';
        worksheet.getCell(`F${rowNum}`).value = ingredient.quantity || '';
        worksheet.getCell(`G${rowNum}`).value = ingredient.unit || '';
        worksheet.getCell(`H${rowNum}`).value = 'Local';
        worksheet.getCell(`I${rowNum}`).value = ingredient.notes || '';
      }
      
      // Apply borders to ingredient columns
      ['C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
        worksheet.getCell(`${col}${rowNum}`).border = {
          top: BORDERS.light,
          bottom: isLastRow ? BORDERS.thick : BORDERS.light,
          left: BORDERS.light,
          right: BORDERS.light,
        };
      });
      
      // Right border for J column (thick)
      worksheet.getCell(`J${rowNum}`).border = {
        top: BORDERS.light,
        bottom: isLastRow ? BORDERS.thick : BORDERS.light,
        left: BORDERS.light,
        right: BORDERS.thick,
      };
    }

    // Row 32: Footer (BBQ CANADA)
    worksheet.mergeCells('B32:J32');
    worksheet.getCell('B32').value = 'BBQ CANADA';
    worksheet.getCell('B32').font = FONTS.small;
    worksheet.getCell('B32').alignment = { horizontal: 'center' };
    worksheet.getCell('B32').border = {
      top: BORDERS.thick,
      left: BORDERS.thick,
      right: BORDERS.thick,
      bottom: BORDERS.thick,
    };
    setRowHeight(32, TEMPLATE_CONFIG.rowHeights.footer);

    // ===== PAGE 2 & 3: Cooking Method with Auto-Pagination =====
    
    // Parse cooking method from Turso schema
    let cookingSteps: { process: string; manual: string; translatedManual?: string }[] = [];
    if (manual.cookingMethod) {
      cookingSteps = [{ process: 'Process', manual: manual.cookingMethod }];
    }

    // Function to create cooking method page
    const createCookingMethodPage = (
      pageNum: 2 | 3,
      content: string,
      isFirstPage: boolean
    ) => {
      const headerRow = pageNum === 2 ? 33 : 66;
      const processRow = pageNum === 2 ? 34 : 67;
      const contentStartRow = pageNum === 2 ? 35 : 68;
      const footerRow = pageNum === 2 ? 65 : 98;

      // Header: COOKING METHOD
      worksheet.mergeCells(`B${headerRow}:J${headerRow}`);
      worksheet.getCell(`B${headerRow}`).value = 'COOKING METHOD';
      worksheet.getCell(`B${headerRow}`).font = FONTS.sectionHeader;
      worksheet.getCell(`B${headerRow}`).fill = { 
        type: 'pattern', 
        pattern: 'solid', 
        fgColor: { argb: 'FFFF6600' } 
      };
      worksheet.getCell(`B${headerRow}`).font = { 
        ...FONTS.sectionHeader, 
        color: { argb: 'FFFFFFFF' } 
      };
      worksheet.getCell(`B${headerRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell(`B${headerRow}`).border = {
        top: BORDERS.thick,
        left: BORDERS.thick,
        right: BORDERS.thick,
        bottom: BORDERS.thin,
      };
      setRowHeight(headerRow, TEMPLATE_CONFIG.rowHeights.sectionHeader);

      // Process/Manual headers
      worksheet.mergeCells(`B${processRow}:D${processRow}`);
      worksheet.getCell(`B${processRow}`).value = 'PROCESS';
      worksheet.getCell(`B${processRow}`).font = { ...FONTS.content, bold: true };
      worksheet.getCell(`B${processRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      worksheet.getCell(`B${processRow}`).border = {
        top: BORDERS.thin,
        left: BORDERS.thick,
        bottom: BORDERS.thin,
      };
      worksheet.mergeCells(`E${processRow}:J${processRow}`);
      worksheet.getCell(`E${processRow}`).value = 'MANUAL';
      worksheet.getCell(`E${processRow}`).font = { ...FONTS.content, bold: true };
      worksheet.getCell(`E${processRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      worksheet.getCell(`J${processRow}`).border = {
        top: BORDERS.thin,
        right: BORDERS.thick,
        bottom: BORDERS.thin,
      };

      // Content area - merge cells for large text area
      worksheet.mergeCells(`E${contentStartRow}:J${footerRow - 1}`);
      const contentCell = worksheet.getCell(`E${contentStartRow}`);
      contentCell.value = content;
      contentCell.font = FONTS.content;
      contentCell.alignment = { 
        horizontal: 'left', 
        vertical: 'top', 
        wrapText: true 
      };
      contentCell.border = {
        top: BORDERS.thin,
        left: BORDERS.thin,
        bottom: BORDERS.thin,
        right: BORDERS.thick,
      };
      
      // Apply borders to content rows
      for (let row = contentStartRow; row < footerRow; row++) {
        worksheet.getCell(`B${row}`).border = { left: BORDERS.thick };
        worksheet.getCell(`J${row}`).border = { right: BORDERS.thick };
      }

      // Footer
      worksheet.mergeCells(`B${footerRow}:J${footerRow}`);
      worksheet.getCell(`B${footerRow}`).value = 'BBQ CANADA';
      worksheet.getCell(`B${footerRow}`).font = FONTS.small;
      worksheet.getCell(`B${footerRow}`).alignment = { horizontal: 'center' };
      worksheet.getCell(`B${footerRow}`).border = {
        top: BORDERS.thick,
        left: BORDERS.thick,
        right: BORDERS.thick,
        bottom: BORDERS.thick,
      };
      setRowHeight(footerRow, TEMPLATE_CONFIG.rowHeights.footer);
    };

    // Combine all cooking steps into formatted text
    let fullCookingContent = '';
    cookingSteps.forEach((step, index) => {
      if (step.process && step.manual) {
        const translatedText = step.translatedManual || step.manual;
        fullCookingContent += `${step.process}:\n${translatedText}\n\n`;
      } else if (step.manual) {
        fullCookingContent += `${step.manual}\n\n`;
      }
    });

    // Split content for pagination
    const maxChars = TEMPLATE_CONFIG.maxCharsPerPage;
    const page2Content = fullCookingContent.substring(0, maxChars);
    const page3Content = fullCookingContent.substring(maxChars);

    // Create Page 2
    createCookingMethodPage(2, page2Content.trim(), true);

    // Create Page 3 if there's overflow content
    if (page3Content.trim()) {
      createCookingMethodPage(3, page3Content.trim(), false);
    }

    // Add page breaks for printing
    worksheet.getRow(32).addPageBreak();
    worksheet.getRow(65).addPageBreak();

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
