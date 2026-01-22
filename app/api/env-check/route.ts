import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Simple environment check without any database imports
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
      hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
      tursoUrlPrefix: process.env.TURSO_DATABASE_URL?.substring(0, 30) + '...',
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    },
  });
}
