import { prisma } from './prisma';
import { headers } from 'next/headers';

export type AuditAction = 
  | 'USER_CREATE' | 'USER_UPDATE' | 'USER_DELETE' | 'USER_PASSWORD_RESET'
  | 'COUNTRY_CREATE' | 'COUNTRY_UPDATE' | 'COUNTRY_DELETE' | 'COUNTRY_BULK_SEED'
  | 'STORE_CREATE' | 'STORE_UPDATE' | 'STORE_DELETE'
  | 'MANUAL_CREATE' | 'MANUAL_UPDATE' | 'MANUAL_DELETE' | 'MANUAL_RESTORE' | 'MANUAL_CLONE' | 'MANUAL_IMPORT'
  | 'TASK_CREATE' | 'TASK_UPDATE' | 'TASK_DELETE'
  | 'PRICE_UPDATE' | 'TEMPLATE_CREATE' | 'TEMPLATE_UPDATE'
  | 'FILE_UPLOAD' | 'FILE_DELETE'
  | 'LOGIN' | 'LOGOUT';

export interface AuditLogParams {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

export async function createAuditLog({
  userId,
  action,
  entityType,
  entityId,
  oldValue,
  newValue
}: AuditLogParams): Promise<void> {
  try {
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldValue: oldValue ? JSON.stringify(oldValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
        ipAddress,
        userAgent
      }
    });
  } catch (error) {
    // Don't let audit logging failure break the main operation
    console.error('Failed to create audit log:', error);
  }
}

// Helper to get changes between two objects
export function getChanges(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>
): { oldValue: Record<string, unknown>; newValue: Record<string, unknown> } {
  const oldValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};

  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      oldValue[key] = oldObj[key];
      newValue[key] = newObj[key];
    }
  }

  return { oldValue, newValue };
}
