import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result: any = {
    timestamp: new Date().toISOString(),
    step: 'start',
  };

  try {
    // Step 1: Check environment
    result.step = 'env';
    result.env = {
      hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
      hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
      nodeEnv: process.env.NODE_ENV,
    };

    // Step 2: Try to import prisma
    result.step = 'import-prisma';
    const { prisma } = require('@/lib/prisma');
    result.prismaImported = true;

    // Step 3: Try a simple prisma query
    result.step = 'prisma-query';
    const manuals = await prisma.menuManual.findMany({
      take: 5,
      select: { id: true, name: true },
    });
    result.manuals = manuals;
    result.step = 'done';

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({
      ...result,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 10).join('\n'),
    });
  }
}
