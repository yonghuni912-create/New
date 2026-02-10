import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Debug endpoint to check LaunchTaskTemplate data
export async function GET(request: NextRequest) {
  try {
    // Count templates
    const totalCount = await prisma.launchTaskTemplate.count();
    
    const defaultCount = await prisma.launchTaskTemplate.count({
      where: { templateName: 'DEFAULT' }
    });
    
    const activeCount = await prisma.launchTaskTemplate.count({
      where: { isActive: true }
    });
    
    const defaultActiveCount = await prisma.launchTaskTemplate.count({
      where: { templateName: 'DEFAULT', isActive: true }
    });
    
    // Get sample templates
    const samples = await prisma.launchTaskTemplate.findMany({
      where: { templateName: 'DEFAULT', isActive: true },
      take: 5,
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        orderIndex: true,
        category: true,
        title: true,
        daysBeforeOpening: true,
        isActive: true
      }
    });
    
    return NextResponse.json({
      success: true,
      counts: {
        total: totalCount,
        default: defaultCount,
        active: activeCount,
        defaultActive: defaultActiveCount
      },
      samples,
      message: defaultActiveCount > 0 
        ? `Found ${defaultActiveCount} templates ready for task generation`
        : 'No active DEFAULT templates found - tasks will not be auto-generated'
    });
  } catch (error: any) {
    console.error('Error checking templates:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
