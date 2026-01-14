import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const envCheck = {
      hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
      hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      nodeEnv: process.env.NODE_ENV,
    };

    // Try to connect to database
    let dbStatus = 'unknown';
    let userCount = 0;
    let errorMessage = null;

    try {
      userCount = await prisma.user.count();
      dbStatus = 'connected';
    } catch (dbError: any) {
      dbStatus = 'error';
      errorMessage = dbError.message;
    }

    return NextResponse.json({
      status: 'ok',
      env: envCheck,
      database: {
        status: dbStatus,
        userCount,
        error: errorMessage,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
