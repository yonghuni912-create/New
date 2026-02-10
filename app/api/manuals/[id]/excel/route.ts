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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    // Get manual
    const manualResult = await db.execute({
      sql: `SELECT * FROM MenuManual WHERE id = ?`,
      args: [id],
    });

    if (manualResult.rows.length === 0) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }

    const manual = manualResult.rows[0];

    // Get ingredients
    const ingredientsResult = await db.execute({
      sql: `SELECT * FROM ManualIngredient WHERE manualId = ? ORDER BY sortOrder ASC`,
      args: [id],
    });
    
    const ingredients = ingredientsResult.rows;

    // Cooking method
    let cookingMethod: any[] = [];
    try {
      cookingMethod = manual.cookingMethod ? JSON.parse(manual.cookingMethod as string) : [];
    } catch (e) {
      cookingMethod = [];
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Build sheet data array matching target template
    // Columns: A(empty), B, C, D, E, F, G, H, I, J
    const sheetData: any[][] = [];
    
    // Row 1: Header "Manual(Kitchen)" - B1:J1 merged
    sheetData.push(['', 'Manual(Kitchen)', '', '', '', '', '', '', '', '']);
    
    // Row 2: Name - B2="Name", C2:J2 merged with menu name
    sheetData.push(['', 'Name', manual.name || '', '', '', '', '', '', '', '']);
    
    // Row 3: Picture label + Shelf Life label
    sheetData.push(['', 'Picture', '', '', '', '', '', '', 'Shelf Life', '']);
    
    // Rows 4-11: Picture area (8 rows)
    for (let i = 0; i < 8; i++) {
      if (i === 0) {
        sheetData.push(['', '', '[No Image]', '', '', '', '', '', manual.shelfLife || '', '']);
      } else {
        sheetData.push(['', '', '', '', '', '', '', '', '', '']);
      }
    }
    
    // Row 12: Empty row
    sheetData.push(['', '', '', '', '', '', '', '', '', '']);
    
    // Row 13: Ingredients header
    sheetData.push(['', 'Ingredients\nComposition', 'No.', 'Ingredients', '', 'Weight', 'Unit', 'Purchase', 'Others', '']);
    
    // Rows 14-29: Ingredient rows (16 rows)
    const maxIngredients = 16;
    for (let i = 0; i < maxIngredients; i++) {
      const ing = ingredients[i];
      if (ing) {
        sheetData.push([
          '',
          '',
          i + 1,
          ing.name || ing.koreanName || '',
          '',
          ing.quantity || '',
          ing.unit || 'g',
          ing.notes || 'Local',
          '',
          ''
        ]);
      } else {
        sheetData.push(['', '', i + 1, '', '', '', '', '', '', '']);
      }
    }
    
    // Row 30: BBQ CANADA
    sheetData.push(['', 'BBQ CANADA', '', '', '', '', '', '', '', '']);
    
    // Row 31: COOKING METHOD header
    sheetData.push(['', 'COOKING METHOD', '', '', '', '', '', '', '', '']);
    
    // Row 32: PROCESS | MANUAL headers
    sheetData.push(['', 'PROCESS', '', '', 'MANUAL', '', '', '', '', '']);
    
    // Filter cooking steps that have content and build manual text
    const stepsWithContent = cookingMethod.filter((step: any) => step.manual && step.manual.trim());
    const manualText = stepsWithContent.map((step: any) => {
      const text = step.translatedManual || step.manual || '';
      return text;
    }).join('\n\n');
    
    // Row 33: First row of cooking method area
    sheetData.push(['', '', '', '', manualText, '', '', '', '', '']);
    
    // Rows 34-62: Rest of cooking method area (29 empty rows)
    for (let i = 0; i < 29; i++) {
      sheetData.push(['', '', '', '', '', '', '', '', '', '']);
    }
    
    // === Second Cooking Method Section ===
    sheetData.push(['', '', '', '', '', '', '', '', '', '']);
    sheetData.push(['', 'BBQ CANADA', '', '', '', '', '', '', '', '']);
    sheetData.push(['', 'COOKING METHOD', '', '', '', '', '', '', '', '']);
    sheetData.push(['', 'PROCESS', '', '', 'MANUAL', '', '', '', '', '']);
    
    // 30 empty rows for second page
    for (let i = 0; i < 30; i++) {
      sheetData.push(['', '', '', '', '', '', '', '', '', '']);
    }
    
    // Final BBQ CANADA row
    sheetData.push(['', 'BBQ CANADA', '', '', '', '', '', '', '', '']);
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Set column widths (matching target template)
    ws['!cols'] = [
      { wch: 2.17, wpx: 18 },   // A
      { wch: 13.33, wpx: 85 },  // B
      { wch: 4.67, wpx: 33 },   // C
      { wch: 5.5, wpx: 38 },    // D
      { wch: 27.67, wpx: 171 }, // E
      { wch: 5.67, wpx: 39 },   // F
      { wch: 4.67, wpx: 33 },   // G
      { wch: 9.67, wpx: 63 },   // H
      { wch: 5.17, wpx: 36 },   // I
      { wch: 18.67, wpx: 117 }  // J
    ];
    
    // Set row heights
    ws['!rows'] = [];
    ws['!rows'][0] = { hpt: 28.5, hpx: 28.5 };
    ws['!rows'][1] = { hpt: 28.5, hpx: 28.5 };
    for (let i = 2; i < 11; i++) {
      ws['!rows'][i] = { hpt: 22.5, hpx: 22.5 };
    }
    ws['!rows'][11] = { hpt: 18, hpx: 18 };
    for (let i = 12; i < 28; i++) {
      ws['!rows'][i] = { hpt: 21, hpx: 21 };
    }
    ws['!rows'][28] = { hpt: 16.5, hpx: 16.5 };
    ws['!rows'][29] = { hpt: 24.75, hpx: 24.75 };
    
    // Set cell merges
    ws['!merges'] = [
      // Row 1: B1:J1
      { s: { c: 1, r: 0 }, e: { c: 9, r: 0 } },
      // Row 2: C2:J2
      { s: { c: 2, r: 1 }, e: { c: 9, r: 1 } },
      // Row 3: I3:J3
      { s: { c: 8, r: 2 }, e: { c: 9, r: 2 } },
      // B3:B11 (vertical Picture label)
      { s: { c: 1, r: 2 }, e: { c: 1, r: 10 } },
      // C3:H11 (Picture area)
      { s: { c: 2, r: 2 }, e: { c: 7, r: 10 } },
      // I4:J11 (Shelf Life value)
      { s: { c: 8, r: 3 }, e: { c: 9, r: 10 } },
      // B12:B28 (Ingredients Composition vertical)
      { s: { c: 1, r: 11 }, e: { c: 1, r: 27 } },
      // D12:E12 (Ingredients header)
      { s: { c: 3, r: 11 }, e: { c: 4, r: 11 } },
      // I12:J12 (Others header)
      { s: { c: 8, r: 11 }, e: { c: 9, r: 11 } },
    ];
    
    // D+E and I+J merges for ingredient rows
    for (let i = 12; i < 28; i++) {
      ws['!merges']!.push({ s: { c: 3, r: i }, e: { c: 4, r: i } });
      ws['!merges']!.push({ s: { c: 8, r: i }, e: { c: 9, r: i } });
    }
    
    // BBQ CANADA (row 29, index 28)
    ws['!merges']!.push({ s: { c: 1, r: 28 }, e: { c: 9, r: 28 } });
    // COOKING METHOD (row 30, index 29)
    ws['!merges']!.push({ s: { c: 1, r: 29 }, e: { c: 9, r: 29 } });
    // PROCESS | MANUAL headers (row 31, index 30)
    ws['!merges']!.push({ s: { c: 1, r: 30 }, e: { c: 3, r: 30 } });
    ws['!merges']!.push({ s: { c: 4, r: 30 }, e: { c: 9, r: 30 } });
    // PROCESS area (B32:D61) and MANUAL area (E32:J61)
    ws['!merges']!.push({ s: { c: 1, r: 31 }, e: { c: 3, r: 60 } });
    ws['!merges']!.push({ s: { c: 4, r: 31 }, e: { c: 9, r: 60 } });
    
    // Second section merges
    ws['!merges']!.push({ s: { c: 1, r: 61 }, e: { c: 9, r: 61 } }); // Empty
    ws['!merges']!.push({ s: { c: 1, r: 62 }, e: { c: 9, r: 62 } }); // BBQ CANADA
    ws['!merges']!.push({ s: { c: 1, r: 63 }, e: { c: 9, r: 63 } }); // COOKING METHOD
    ws['!merges']!.push({ s: { c: 1, r: 64 }, e: { c: 3, r: 64 } }); // PROCESS
    ws['!merges']!.push({ s: { c: 4, r: 64 }, e: { c: 9, r: 64 } }); // MANUAL
    ws['!merges']!.push({ s: { c: 1, r: 65 }, e: { c: 3, r: 94 } }); // PROCESS area
    ws['!merges']!.push({ s: { c: 4, r: 65 }, e: { c: 9, r: 94 } }); // MANUAL area
    ws['!merges']!.push({ s: { c: 1, r: 95 }, e: { c: 9, r: 95 } }); // Final BBQ CANADA
    
    const sheetName = typeof manual.name === 'string' ? manual.name.substring(0, 30).replace(/[\/\\?*\[\]]/g, '') : 'Manual';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Generate Excel buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    
    // Return Excel file
    const fileName = encodeURIComponent(`${manual.name || 'manual'}.xlsx`);
    
    console.log('✅ Excel generated for manual:', id);
    
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('❌ Error generating Excel:', error);
    return NextResponse.json({ error: 'Failed to generate Excel', details: error?.message || String(error) }, { status: 500 });
  }
}
