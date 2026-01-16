import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const manual = await prisma.menuManual.findUnique({
      where: { id },
      include: {
        ingredients: {
          orderBy: { sortOrder: 'asc' },
          include: { ingredientMaster: true }
        }
      }
    });

    if (!manual) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }

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
    const ingredientsData = manual.ingredients.map((ing, idx) => [
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
    const cookingData = cookingMethod.map(step => [
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
    
    XLSX.utils.book_append_sheet(wb, ws, manual.name?.substring(0, 30) || 'Manual');
    
    // Generate Excel buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    
    // Return Excel file
    const fileName = encodeURIComponent(`${manual.name || 'manual'}.xlsx`);
    
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Error generating Excel:', error);
    return NextResponse.json({ error: 'Failed to generate Excel' }, { status: 500 });
  }
}