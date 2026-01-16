import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import * as XLSX from 'xlsx';

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

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Header data
    const headerData = [
      ['Name', manual.name || ''],
      ['한글명', manual.koreanName || ''],
      ['판매가', manual.sellingPrice || ''],
      ['유통기한', manual.shelfLife || ''],
      [''],
    ];
    
    // Ingredients header
    const ingredientsHeader = ['No.', 'Ingredients', 'Qty', 'Unit', 'Notes'];
    const ingredientsData = ingredients.map((ing, idx) => [
      idx + 1,
      ing.koreanName || ing.name,
      ing.quantity || 0,
      ing.unit || 'g',
      ing.notes || 'Local'
    ]);
    
    // Cooking method
    let cookingMethod: any[] = [];
    try {
      cookingMethod = manual.cookingMethod ? JSON.parse(manual.cookingMethod as string) : [];
    } catch (e) {
      cookingMethod = [];
    }
    
    const cookingHeader = ['PROCESS', 'MANUAL'];
    const cookingData = cookingMethod.map((step: any) => [
      step.process || '',
      step.translatedManual || step.manual || ''
    ]);
    
    // Combine all data
    const sheetData = [
      ...headerData,
      ['Ingredients Composition'],
      ingredientsHeader,
      ...ingredientsData,
      [''],
      ['COOKING METHOD'],
      cookingHeader,
      ...cookingData
    ];
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 20 },
      { wch: 40 },
      { wch: 10 },
      { wch: 10 },
      { wch: 15 }
    ];
    
    const sheetName = typeof manual.name === 'string' ? manual.name.substring(0, 30) : 'Manual';
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