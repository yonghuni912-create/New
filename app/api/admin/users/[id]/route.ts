import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@libsql/client';
import crypto from 'crypto';
import { hasPermission, isMasterAdmin, getAssignableRoles } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

function getDbClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;
  return createClient({ url, authToken });
}

// PATCH - Update user role
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserRole = (session.user as any)?.role;
    const currentUserId = (session.user as any)?.id;
    const currentUserEmail = (session.user as any)?.email;

    // Check if user is master admin by role OR by special email
    const isUserMasterAdmin = isMasterAdmin(currentUserRole) || 
      currentUserEmail === 'admin@bbq.com' || 
      currentUserEmail === 'kun.lee@bbqchickenca.com';

    if (!hasPermission(currentUserRole, 'canManageUsers')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { role: newRole } = await request.json();
    const targetUserId = params.id;

    if (!newRole) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 });
    }

    const db = getDbClient();
    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // Get target user
    const targetUser = await db.execute({
      sql: 'SELECT id, email, role FROM "User" WHERE id = ?',
      args: [targetUserId],
    });

    if (targetUser.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUserData = targetUser.rows[0];

    // Prevent modifying MASTER_ADMIN users (only MASTER_ADMIN can do it)
    if (targetUserData.role === 'MASTER_ADMIN' && !isUserMasterAdmin) {
      return NextResponse.json(
        { error: 'Cannot modify Master Admin user' },
        { status: 403 }
      );
    }

    // Prevent self-demotion for MASTER_ADMIN
    if (targetUserId === currentUserId && isUserMasterAdmin && newRole !== 'MASTER_ADMIN') {
      return NextResponse.json(
        { error: 'Master Admin cannot demote themselves' },
        { status: 403 }
      );
    }

    // Check if the new role can be assigned by current user
    // If user is master by email, use master-level assignable roles
    const effectiveRole = isUserMasterAdmin ? 'MASTER_ADMIN' : currentUserRole;
    const assignableRoles = getAssignableRoles(effectiveRole);
    const canAssignRole = assignableRoles.some(r => r.value === newRole) || 
                          (isUserMasterAdmin && newRole === 'MASTER_ADMIN');

    if (!canAssignRole) {
      return NextResponse.json(
        { error: 'You cannot assign this role' },
        { status: 403 }
      );
    }

    // Update user role
    await db.execute({
      sql: 'UPDATE "User" SET role = ?, updatedAt = datetime("now") WHERE id = ?',
      args: [newRole, targetUserId],
    });

    // Log audit
    try {
      await db.execute({
        sql: 'INSERT INTO "AuditLog" (id, userId, action, entityType, entityId, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
        args: [
          crypto.randomUUID(),
          currentUserId || 'system',
          'UPDATE_ROLE',
          'User',
          targetUserId,
          JSON.stringify({
            email: targetUserData.email,
            oldRole: targetUserData.role,
            newRole: newRole,
          }),
        ],
      });
    } catch {
      // Audit log is optional
    }

    return NextResponse.json({
      message: 'User role updated successfully',
      user: {
        id: targetUserId,
        email: targetUserData.email,
        role: newRole,
      },
    });
  } catch (error) {
    console.error('Update user role error:', error);
    return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });
  }
}

// DELETE - Delete user (Master Admin only for certain users)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserRole = (session.user as any)?.role;
    const currentUserId = (session.user as any)?.id;
    const targetUserId = params.id;

    if (!hasPermission(currentUserRole, 'canManageUsers')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const db = getDbClient();
    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // Get target user
    const targetUser = await db.execute({
      sql: 'SELECT id, email, role FROM "User" WHERE id = ?',
      args: [targetUserId],
    });

    if (targetUser.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUserData = targetUser.rows[0];

    // Cannot delete MASTER_ADMIN users
    if (targetUserData.role === 'MASTER_ADMIN') {
      return NextResponse.json(
        { error: 'Cannot delete Master Admin user' },
        { status: 403 }
      );
    }

    // Cannot delete yourself
    if (targetUserId === currentUserId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 403 }
      );
    }

    // Only MASTER_ADMIN can delete ADMIN users
    if (targetUserData.role === 'ADMIN' && !isMasterAdmin(currentUserRole)) {
      return NextResponse.json(
        { error: 'Only Master Admin can delete Admin users' },
        { status: 403 }
      );
    }

    // Delete user
    await db.execute({
      sql: 'DELETE FROM "User" WHERE id = ?',
      args: [targetUserId],
    });

    // Log audit
    try {
      await db.execute({
        sql: 'INSERT INTO "AuditLog" (id, userId, action, entityType, entityId, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
        args: [
          crypto.randomUUID(),
          currentUserId || 'system',
          'DELETE_USER',
          'User',
          targetUserId,
          JSON.stringify({
            email: targetUserData.email,
            role: targetUserData.role,
          }),
        ],
      });
    } catch {
      // Audit log is optional
    }

    return NextResponse.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
