import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function getDbClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;
  return createClient({ url, authToken });
}

// GET all users (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any)?.role;
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const db = getDbClient();
    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const result = await db.execute({
      sql: 'SELECT id, email, name, role, createdAt, updatedAt FROM "User" ORDER BY createdAt DESC',
      args: [],
    });

    return NextResponse.json({
      users: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Failed to get users' }, { status: 500 });
  }
}

// POST create new user (admin only)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any)?.role;
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { email, name, password, userRole } = await request.json();

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'Email, name, and password are required' },
        { status: 400 }
      );
    }

    const db = getDbClient();
    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // Check if user exists
    const existing = await db.execute({
      sql: 'SELECT id FROM "User" WHERE email = ?',
      args: [email],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    // Create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await db.execute({
      sql: 'INSERT INTO "User" (id, email, name, password, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, datetime("now"), datetime("now"))',
      args: [userId, email, name, hashedPassword, userRole || 'VIEWER'],
    });

    // Log audit
    try {
      await db.execute({
        sql: 'INSERT INTO "AuditLog" (id, userId, action, entityType, entityId, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
        args: [
          crypto.randomUUID(),
          (session.user as any)?.id || 'system',
          'CREATE',
          'User',
          userId,
          JSON.stringify({ email, name, role: userRole }),
        ],
      });
    } catch {
      // Audit log is optional
    }

    return NextResponse.json({
      message: 'User created successfully',
      user: { id: userId, email, name, role: userRole || 'VIEWER' },
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
