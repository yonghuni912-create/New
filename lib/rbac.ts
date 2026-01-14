import { UserRole } from '@/lib/enums';

export type Permission = 
  | 'store:create'
  | 'store:edit'
  | 'store:delete'
  | 'store:view'
  | 'task:create'
  | 'task:edit'
  | 'task:delete'
  | 'task:view'
  | 'task:assign'
  | 'user:manage'
  | 'template:manage'
  | 'audit:view';

const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    'store:create',
    'store:edit',
    'store:delete',
    'store:view',
    'task:create',
    'task:edit',
    'task:delete',
    'task:view',
    'task:assign',
    'user:manage',
    'template:manage',
    'audit:view',
  ],
  [UserRole.PM]: [
    'store:create',
    'store:edit',
    'store:view',
    'task:create',
    'task:edit',
    'task:delete',
    'task:view',
    'task:assign',
    'audit:view',
  ],
  [UserRole.CONTRIBUTOR]: [
    'store:view',
    'task:edit',
    'task:view',
  ],
  [UserRole.VIEWER]: [
    'store:view',
    'task:view',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function canEditStore(role: UserRole): boolean {
  return hasPermission(role, 'store:edit');
}

export function canCreateStore(role: UserRole): boolean {
  return hasPermission(role, 'store:create');
}

export function canDeleteStore(role: UserRole): boolean {
  return hasPermission(role, 'store:delete');
}

export function canEditTask(role: UserRole): boolean {
  return hasPermission(role, 'task:edit');
}

export function canCreateTask(role: UserRole): boolean {
  return hasPermission(role, 'task:create');
}

export function canDeleteTask(role: UserRole): boolean {
  return hasPermission(role, 'task:delete');
}

export function canAssignTask(role: UserRole): boolean {
  return hasPermission(role, 'task:assign');
}

export function canManageUsers(role: UserRole): boolean {
  return hasPermission(role, 'user:manage');
}

export function canManageTemplates(role: UserRole): boolean {
  return hasPermission(role, 'template:manage');
}

export function canViewAuditLogs(role: UserRole): boolean {
  return hasPermission(role, 'audit:view');
}
