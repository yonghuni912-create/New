import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

// GET: Export store tasks to Excel with formatting similar to the original template
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

    // Get store with tasks
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        tasks: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            category: true,
            subcategory: true,
            startDate: true,
            dueDate: true,
            assigneeId: true,
            orderIndex: true,
            phaseId: true,
            durationDays: true,
            daysBeforeOpening: true,
            completedAt: true,
            assignee: {
              select: { name: true, email: true }
            }
          }
        },
      },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const storeName = store.storeName || store.storeCode;
    const openDate = store.plannedOpenDate;

    // Create workbook
    const wb = XLSX.utils.book_new();

    // === Sheet 1: 세부 런칭 스케줄 (Detailed Launch Schedule) ===
    const scheduleData: (string | number | null)[][] = [];

    // Title rows (matching original format)
    scheduleData.push(['', '',' ', '', '', '', '', '', '', '']);
    scheduleData.push(['', `${storeName} 세부 런칭 스케줄`, '', '', '', '', '', '', '', '']);
    scheduleData.push(['', '', '', '', '', '', '', '', '', '']);
    scheduleData.push(['', '프로젝트명', '', storeName, '', '', '', '', '', '']);
    scheduleData.push(['', '관리자', '', '', '', '', '', '', '', '']);
    scheduleData.push(['', '날짜', '', openDate ? format(openDate, 'yyyy-MM-dd') : '', '', '', '', '', '', '']);
    scheduleData.push(['', '', '', '', '', '', '', '', '', '']);
    
    // Header row (exactly matching original columns)
    scheduleData.push([
      '',      // A
      '단계',  // B - Phase
      '세부정보', // C - Details section header
      '',      // D
      '',      // E
      '',      // F
      '',      // G
      '',      // H
      '',      // I
      ''       // J
    ]);
    
    // Sub-header row
    scheduleData.push([
      '',            // A
      'No.',         // B - Number
      '구분',        // C - Category
      '업무',        // D - Subcategory
      '세부내용',    // E - Task Title
      '소요\n기간\n(일)', // F - Duration
      '목표일',      // G - Target Date
      'Task Start',  // H - Days Before Opening
      '남은\n기간',  // I - Remaining Days
      '완료일',      // J - Completed Date
      '상태',        // K - Status
      '담당자'       // L - Assignee
    ]);

    // Empty row
    scheduleData.push(['', '', '', '', '', '', '', '', '', '', '', '']);

    // Task rows grouped by category
    const tasksByCategory = store.tasks.reduce<Record<string, typeof store.tasks>>((acc, task) => {
      const category = task.category || 'Other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(task);
      return acc;
    }, {});

    let rowNumber = 1;
    const today = new Date();

    for (const [category, tasks] of Object.entries(tasksByCategory)) {
      // Group tasks by subcategory within category
      const tasksBySubcategory = tasks.reduce<Record<string, typeof tasks>>((acc, task) => {
        const subcategory = task.subcategory || '';
        if (!acc[subcategory]) acc[subcategory] = [];
        acc[subcategory].push(task);
        return acc;
      }, {});

      let isFirstInCategory = true;

      for (const [subcategory, subTasks] of Object.entries(tasksBySubcategory)) {
        let isFirstInSubcategory = true;

        for (const task of subTasks) {
          const dueDate = task.dueDate ? new Date(task.dueDate) : null;
          const remainingDays = dueDate ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
          
          // Map status to Korean
          const statusMap: Record<string, string> = {
            'TODO': '대기',
            'IN_PROGRESS': '진행중',
            'DONE': '완료',
            'COMPLETED': '완료',
            'ON_HOLD': '보류',
            'BLOCKED': '차단됨',
            'CANCELLED': '취소',
          };

          scheduleData.push([
            '',                                                                    // A
            rowNumber,                                                             // B - No.
            isFirstInCategory ? category : '',                                     // C - Category (only first row)
            isFirstInSubcategory ? subcategory : '',                               // D - Subcategory (only first row)
            task.title,                                                            // E - Task Title
            task.durationDays || 1,                                                // F - Duration
            dueDate ? format(dueDate, 'yyyy-MM-dd') : '',                          // G - Target Date
            task.daysBeforeOpening ?? '',                                          // H - Days Before Opening
            remainingDays !== null ? remainingDays : '',                           // I - Remaining Days
            task.completedAt ? format(task.completedAt, 'yyyy-MM-dd') : '',        // J - Completed Date
            statusMap[task.status] || task.status,                                 // K - Status
            task.assignee?.name || '',                                             // L - Assignee
          ]);

          rowNumber++;
          isFirstInCategory = false;
          isFirstInSubcategory = false;
        }
      }
    }

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(scheduleData);

    // Set column widths (matching original format)
    ws['!cols'] = [
      { wch: 3 },   // A - Margin
      { wch: 5 },   // B - No.
      { wch: 12 },  // C - Category
      { wch: 18 },  // D - Subcategory
      { wch: 35 },  // E - Task Title
      { wch: 8 },   // F - Duration
      { wch: 12 },  // G - Target Date
      { wch: 10 },  // H - Days Before
      { wch: 8 },   // I - Remaining
      { wch: 12 },  // J - Completed Date
      { wch: 10 },  // K - Status
      { wch: 15 },  // L - Assignee
    ];

    // Set row heights for header rows
    ws['!rows'] = [
      { hpt: 15 },  // Row 1
      { hpt: 25 },  // Row 2 - Title
      { hpt: 15 },  // Row 3
      { hpt: 20 },  // Row 4
      { hpt: 20 },  // Row 5
      { hpt: 20 },  // Row 6
      { hpt: 15 },  // Row 7
      { hpt: 20 },  // Row 8
      { hpt: 45 },  // Row 9 - Headers (multi-line)
      { hpt: 15 },  // Row 10
    ];

    // Merge cells for title
    ws['!merges'] = [
      { s: { r: 1, c: 1 }, e: { r: 1, c: 6 } },  // Title merge
      { s: { r: 7, c: 2 }, e: { r: 7, c: 4 } },  // "세부정보" merge
    ];

    XLSX.utils.book_append_sheet(wb, ws, '세부 런칭 스케줄');

    // === Sheet 2: Summary by Category ===
    const summaryData: (string | number)[][] = [];
    summaryData.push(['카테고리', '총 타스크', '완료', '진행중', '대기', '완료율']);

    for (const [category, tasks] of Object.entries(tasksByCategory)) {
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === 'DONE' || t.status === 'COMPLETED').length;
      const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
      const waiting = tasks.filter(t => t.status === 'TODO').length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      summaryData.push([
        category,
        total,
        completed,
        inProgress,
        waiting,
        `${completionRate}%`
      ]);
    }

    // Total row
    const totalTasks = store.tasks.length;
    const totalCompleted = store.tasks.filter(t => t.status === 'DONE' || t.status === 'COMPLETED').length;
    const totalInProgress = store.tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const totalWaiting = store.tasks.filter(t => t.status === 'TODO').length;
    const totalRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    summaryData.push(['']);
    summaryData.push(['전체', totalTasks, totalCompleted, totalInProgress, totalWaiting, `${totalRate}%`]);

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [
      { wch: 20 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(wb, summaryWs, '카테고리별 요약');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Return as downloadable file
    const fileName = `${storeName}_런칭스케줄_${format(new Date(), 'yyyyMMdd')}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting tasks to Excel:', error);
    return NextResponse.json(
      { error: 'Failed to export tasks' },
      { status: 500 }
    );
  }
}
