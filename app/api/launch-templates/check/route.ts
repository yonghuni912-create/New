import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Debug endpoint to check LaunchTaskTemplate data - PUBLIC for debugging
export async function GET(request: NextRequest) {
  try {
    // Get Turso URL for verification (masked)
    const tursoUrl = process.env.TURSO_DATABASE_URL || 'not set';
    const tursoMasked = tursoUrl.substring(0, 30) + '...';
    
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
      database: tursoMasked,
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
      code: error.code,
      tursoUrl: (process.env.TURSO_DATABASE_URL || 'not set').substring(0, 30) + '...',
      stack: error.stack?.split('\n').slice(0, 5)
    }, { status: 500 });
  }
}
