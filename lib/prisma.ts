import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const isServerRuntime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build';
  
  if (isServerRuntime) {
    // Support both DATABASE_URL and TURSO_DATABASE_URL for flexibility
    const databaseUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    
    if (!databaseUrl || !authToken) {
      throw new Error('FATAL: TURSO_DATABASE_URL (or DATABASE_URL) and TURSO_AUTH_TOKEN must be set in the production environment.');
    }
    
    console.log('Initializing Prisma with Turso adapter for production runtime...');
    try {
      const { createClient } = require('@libsql/client');
      const { PrismaLibSQL } = require('@prisma/adapter-libsql');
      
      const libsql = createClient({
        url: databaseUrl,
        authToken: authToken,
      });
      
      const adapter = new PrismaLibSQL(libsql);
      return new PrismaClient({ adapter } as any);
    } catch (e) {
      console.error('Failed to create Turso adapter:', e);
      // Throw a more specific error to make debugging easier
      throw new Error(`Failed to initialize Turso adapter. Check DATABASE_URL and TURSO_AUTH_TOKEN. Original error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  
  // Local development or build time: Use the default configuration from schema.prisma
  console.log('Initializing Prisma with default provider (likely SQLite for dev/build)...');
  return new PrismaClient();
}

// Prevent multiple instances of Prisma Client in development
export const prisma = global.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
