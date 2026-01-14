import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch manual data with related information
    const manual = await prisma.menuManual.findUnique({
      where: { id: params.id },
      include: {
        groups: {
          include: {
            ingredients: {
              include: {
                ingredient: true,
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!manual) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Manual');

    // Set up letter size dimensions (768px width × 912px height per page)
    // Column widths (B~J columns totaling 768px)
    worksheet.getColumn('B').width = 14.23; // 106px
    worksheet.getColumn('C').width = 5.32;  // 40px
    worksheet.getColumn('D').width = 5.98;  // 45px
    worksheet.getColumn('E').width = 29.26; // 213px
    worksheet.getColumn('F').width = 6.38;  // 48px
    worksheet.getColumn('G').width = 5.32;  // 40px
    worksheet.getColumn('H').width = 10.24; // 76px
    worksheet.getColumn('I').width = 5.72;  // 43px
    worksheet.getColumn('J').width = 19.95; // 146px

    // Page 1: Header and Ingredients
    // Row 1-2: Main Title
    const titleRow1 = worksheet.getRow(1);
    titleRow1.height = 38.3 / 1.33; // Convert px to row height
    worksheet.mergeCells('B1:J1');
    const titleCell = worksheet.getCell('B1');
    titleCell.value = 'Manual (Kitchen)';
    titleCell.font = { name: 'Arial', size: 20, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.border = {
      top: { style: 'medium' },
      left: { style: 'medium' },
      right: { style: 'medium' },
      bottom: { style: 'thin' },
    };

    // Row 2: Item Name
    const titleRow2 = worksheet.getRow(2);
    titleRow2.height = 38.3 / 1.33;
    worksheet.mergeCells('C2:J2');
    const itemNameCell = worksheet.getCell('C2');
    itemNameCell.value = manual.menuNameEn;
    itemNameCell.font = { name: 'Arial', size: 16, bold: true };
    itemNameCell.alignment = { vertical: 'middle', horizontal: 'left' };
    itemNameCell.border = {
      top: { style: 'thin' },
      left: { style: 'medium' },
      right: { style: 'medium' },
      bottom: { style: 'medium' },
    };

    // Rows 3-11: Empty space
    for (let i = 3; i <= 11; i++) {
      worksheet.getRow(i).height = 27.8 / 1.33;
    }

    // Row 12: Ingredients Header
    const ingHeaderRow = worksheet.getRow(12);
    ingHeaderRow.height = 32.7 / 1.33;
    worksheet.mergeCells('B12:J12');
    const ingHeaderCell = worksheet.getCell('B12');
    ingHeaderCell.value = 'Ingredients';
    ingHeaderCell.font = { name: 'Arial', size: 13, bold: true };
    ingHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ingHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };
    ingHeaderCell.border = {
      top: { style: 'medium' },
      left: { style: 'medium' },
      right: { style: 'medium' },
      bottom: { style: 'medium' },
    };

    // Rows 13-31: Ingredient details
    let currentRow = 13;
    let ingredientNumber = 1;

    for (const group of manual.groups) {
      for (const item of group.ingredients) {
        if (currentRow > 31) break;

        const row = worksheet.getRow(currentRow);
        row.height = 27.8 / 1.33;

        // Column C: No.
        const noCell = worksheet.getCell(`C${currentRow}`);
        noCell.value = ingredientNumber++;
        noCell.alignment = { vertical: 'middle', horizontal: 'center' };
        noCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
          bottom: { style: 'thin' },
        };

        // Column E: Ingredient Name
        const nameCell = worksheet.getCell(`E${currentRow}`);
        nameCell.value = item.ingredient.nameEn;
        nameCell.alignment = { vertical: 'middle', horizontal: 'left' };
        nameCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
          bottom: { style: 'thin' },
        };

        // Column F: Weight
        const weightCell = worksheet.getCell(`F${currentRow}`);
        weightCell.value = item.quantity;
        weightCell.alignment = { vertical: 'middle', horizontal: 'center' };
        weightCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
          bottom: { style: 'thin' },
        };

        // Column G: Unit
        const unitCell = worksheet.getCell(`G${currentRow}`);
        unitCell.value = item.unit;
        unitCell.alignment = { vertical: 'middle', horizontal: 'center' };
        unitCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
          bottom: { style: 'thin' },
        };

        currentRow++;
      }
    }

    // Row 32: Footer
    const footerRow1 = worksheet.getRow(32);
    footerRow1.height = 22.1 / 1.33;
    worksheet.mergeCells('B32:J32');
    const footerCell1 = worksheet.getCell('B32');
    footerCell1.value = 'BBQ CANADA';
    footerCell1.font = { name: 'Arial', size: 11, bold: true };
    footerCell1.alignment = { vertical: 'middle', horizontal: 'right' };
    footerCell1.border = {
      top: { style: 'medium' },
      left: { style: 'medium' },
      right: { style: 'medium' },
      bottom: { style: 'medium' },
    };

    // Page 2: Cooking Method
    // Row 33: Cooking Method Header
    const cookHeaderRow = worksheet.getRow(33);
    cookHeaderRow.height = 32.7 / 1.33;
    worksheet.mergeCells('B33:J33');
    const cookHeaderCell = worksheet.getCell('B33');
    cookHeaderCell.value = 'COOKING METHOD';
    cookHeaderCell.font = { name: 'Arial', size: 13, bold: true };
    cookHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
    cookHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };
    cookHeaderCell.border = {
      top: { style: 'medium' },
      left: { style: 'medium' },
      right: { style: 'medium' },
      bottom: { style: 'medium' },
    };

    // Row 34: Empty
    worksheet.getRow(34).height = 27.8 / 1.33;

    // Rows 35-64: Cooking instructions (900 character limit)
    worksheet.mergeCells('E35:J64');
    const cookingCell = worksheet.getCell('E35');
    const description = manual.description || '';
    const firstPageText = description.substring(0, 900);
    cookingCell.value = firstPageText;
    cookingCell.font = { name: 'Arial', size: 11.5 };
    cookingCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    cookingCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' },
    };

    // Set height for rows 35-64
    for (let i = 35; i <= 64; i++) {
      worksheet.getRow(i).height = 27.8 / 1.33;
    }

    // Row 65: Footer
    const footerRow2 = worksheet.getRow(65);
    footerRow2.height = 22.1 / 1.33;
    worksheet.mergeCells('B65:J65');
    const footerCell2 = worksheet.getCell('B65');
    footerCell2.value = 'BBQ CANADA';
    footerCell2.font = { name: 'Arial', size: 11, bold: true };
    footerCell2.alignment = { vertical: 'middle', horizontal: 'right' };
    footerCell2.border = {
      top: { style: 'medium' },
      left: { style: 'medium' },
      right: { style: 'medium' },
      bottom: { style: 'medium' },
    };

    // Page 3: Continued cooking method (if text exceeds 900 characters)
    if (description.length > 900) {
      // Row 66: Cooking Method Header (continued)
      const cookHeaderRow2 = worksheet.getRow(66);
      cookHeaderRow2.height = 32.7 / 1.33;
      worksheet.mergeCells('B66:J66');
      const cookHeaderCell2 = worksheet.getCell('B66');
      cookHeaderCell2.value = 'COOKING METHOD (Continued)';
      cookHeaderCell2.font = { name: 'Arial', size: 13, bold: true };
      cookHeaderCell2.alignment = { vertical: 'middle', horizontal: 'center' };
      cookHeaderCell2.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' },
      };
      cookHeaderCell2.border = {
        top: { style: 'medium' },
        left: { style: 'medium' },
        right: { style: 'medium' },
        bottom: { style: 'medium' },
      };

      // Row 67: Empty
      worksheet.getRow(67).height = 27.8 / 1.33;

      // Rows 68-97: Continued text
      worksheet.mergeCells('E68:J97');
      const continuedCell = worksheet.getCell('E68');
      const continuedText = description.substring(900);
      continuedCell.value = continuedText;
      continuedCell.font = { name: 'Arial', size: 11.5 };
      continuedCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      continuedCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
        bottom: { style: 'thin' },
      };

      // Set height for rows 68-97
      for (let i = 68; i <= 97; i++) {
        worksheet.getRow(i).height = 27.8 / 1.33;
      }

      // Row 98: Footer
      const footerRow3 = worksheet.getRow(98);
      footerRow3.height = 22.1 / 1.33;
      worksheet.mergeCells('B98:J98');
      const footerCell3 = worksheet.getCell('B98');
      footerCell3.value = 'BBQ CANADA';
      footerCell3.font = { name: 'Arial', size: 11, bold: true };
      footerCell3.alignment = { vertical: 'middle', horizontal: 'right' };
      footerCell3.border = {
        top: { style: 'medium' },
        left: { style: 'medium' },
        right: { style: 'medium' },
        bottom: { style: 'medium' },
      };
    }

    // Add page breaks
    worksheet.pageSetup.printArea = 'B1:J32'; // First page
    worksheet.addConditionalFormatting({
      ref: 'B1:J98',
      rules: [],
    });

    // Set up print settings
    worksheet.pageSetup.paperSize = undefined; // Let Excel decide based on margins
    worksheet.pageSetup.orientation = 'portrait';
    worksheet.pageSetup.margins = {
      left: 0.25,
      right: 0.25,
      top: 0.25,
      bottom: 0.25,
      header: 0,
      footer: 0,
    };
    worksheet.pageSetup.fitToPage = true;
    worksheet.pageSetup.fitToWidth = 1;

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${manual.menuCode}_manual.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error generating Excel:', error);
    return NextResponse.json({ error: 'Failed to generate Excel file' }, { status: 500 });
  }
}
