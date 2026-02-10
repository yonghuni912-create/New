import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

// POST: Parse Excel file and import launch templates
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const templateName = formData.get('templateName') as string || 'DEFAULT';
    const sheetName = formData.get('sheetName') as string || '세부 런칭 스케줄';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Parse Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      const availableSheets = workbook.SheetNames;
      return NextResponse.json(
        { error: `Sheet "${sheetName}" not found. Available sheets: ${availableSheets.join(', ')}` },
        { status: 400 }
      );
    }

    // Parse the sheet data
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
    
    // Find the header row (contains '구분', '업무', '세부내용', etc.)
    let headerRowIndex = -1;
    const headerKeywords = ['구분', '업무', '세부내용', '소요'];
    
    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row = data[i];
      if (row && row.some(cell => 
        cell && typeof cell === 'string' && 
        headerKeywords.some(kw => cell.includes(kw))
      )) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json(
        { error: 'Could not find header row in the Excel file' },
        { status: 400 }
      );
    }

    // Parse tasks starting from the row after header
    const tasks: {
      orderIndex: number;
      category: string;
      subcategory: string | null;
      title: string;
      durationDays: number;
      daysBeforeOpening: number;
    }[] = [];

    let currentCategory = '';
    let currentSubcategory = '';
    let orderIndex = 1;

    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 8) continue;

      // Column indices (0-based):
      // C (2): 구분 (Category)
      // D (3): 업무 (Subcategory)
      // E (4): 세부내용 (Task title)
      // F (5): 소요기간 (Duration)
      // G (6): 목표일 (Target date) - we don't use this directly
      // H (7): Task Start (Days before opening)

      const categoryCell = row[2];
      const subcategoryCell = row[3];
      const titleCell = row[4];
      const durationCell = row[5];
      const daysBeforeCell = row[7];

      // Update current category/subcategory if provided
      if (categoryCell && typeof categoryCell === 'string' && categoryCell.trim()) {
        currentCategory = categoryCell.trim();
      }
      if (subcategoryCell && typeof subcategoryCell === 'string' && subcategoryCell.trim()) {
        currentSubcategory = subcategoryCell.trim().replace(/\n/g, ' ');
      }

      // Skip rows without a title
      if (!titleCell || typeof titleCell !== 'string' || !titleCell.trim()) {
        continue;
      }

      const title = titleCell.trim();
      const durationDays = typeof durationCell === 'number' ? durationCell : 
                          parseInt(String(durationCell) || '1', 10) || 1;
      const daysBeforeOpening = typeof daysBeforeCell === 'number' ? daysBeforeCell :
                               parseInt(String(daysBeforeCell) || '0', 10) || 0;

      // Only add if we have a category
      if (currentCategory) {
        tasks.push({
          orderIndex,
          category: currentCategory,
          subcategory: currentSubcategory || null,
          title,
          durationDays: Math.max(1, durationDays),
          daysBeforeOpening,
        });
        orderIndex++;
      }
    }

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: 'No valid tasks found in the Excel file' },
        { status: 400 }
      );
    }

    // Delete existing templates with same name
    await prisma.launchTaskTemplate.deleteMany({
      where: { templateName },
    });

    // Create new templates
    const createdTemplates = await prisma.$transaction(
      tasks.map((task) =>
        prisma.launchTaskTemplate.create({
          data: {
            templateName,
            ...task,
            isActive: true,
          },
        })
      )
    );

    return NextResponse.json({
      message: `Imported ${createdTemplates.length} tasks from Excel`,
      count: createdTemplates.length,
      templateName,
      preview: tasks.slice(0, 5).map(t => ({ 
        category: t.category, 
        subcategory: t.subcategory, 
        title: t.title,
        durationDays: t.durationDays,
        daysBeforeOpening: t.daysBeforeOpening 
      })),
    });
  } catch (error) {
    console.error('Error importing Excel template:', error);
    return NextResponse.json(
      { error: 'Failed to import Excel template' },
      { status: 500 }
    );
  }
}
