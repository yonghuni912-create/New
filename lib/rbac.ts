// Role-Based Access Control utilities

export type Role = 'ADMIN' | 'PM' | 'CONTRIBUTOR' | 'VIEWER';

export interface Permission {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canApprove: boolean;
  canExport: boolean;
}

const rolePermissions: Record<Role, Permission> = {
  ADMIN: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageUsers: true,
    canManageSettings: true,
    canApprove: true,
    canExport: true,
  },
  PM: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canManageUsers: false,
    canManageSettings: false,
    canApprove: true,
    canExport: true,
  },
  CONTRIBUTOR: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canManageUsers: false,
    canManageSettings: false,
    canApprove: false,
    canExport: true,
  },
  VIEWER: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canManageUsers: false,
    canManageSettings: false,
    canApprove: false,
    canExport: false,
  },
};

export function getPermissions(role: string | undefined | null): Permission {
  const normalizedRole = (role?.toUpperCase() || 'VIEWER') as Role;
  return rolePermissions[normalizedRole] || rolePermissions.VIEWER;
}

export function hasPermission(
  role: string | undefined | null,
  permission: keyof Permission
): boolean {
  return getPermissions(role)[permission];
}

export function canAccessRoute(
  role: string | undefined | null,
  route: string
): boolean {
  const permissions = getPermissions(role);

  // Admin-only routes
  const adminRoutes = ['/dashboard/admin'];
  if (adminRoutes.some((r) => route.startsWith(r))) {
    return role === 'ADMIN';
  }

  // PM or higher routes
  const pmRoutes = ['/dashboard/stores/new'];
  if (pmRoutes.some((r) => route.startsWith(r))) {
    return ['ADMIN', 'PM'].includes(role?.toUpperCase() || '');
  }

  return permissions.canView;
}

export function getRoleBadgeColor(role: string | undefined | null): string {
  switch (role?.toUpperCase()) {
    case 'ADMIN':
      return 'bg-red-100 text-red-800';
    case 'PM':
      return 'bg-blue-100 text-blue-800';
    case 'CONTRIBUTOR':
      return 'bg-green-100 text-green-800';
    case 'VIEWER':
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getRoleDisplayName(role: string | undefined | null): string {
  switch (role?.toUpperCase()) {
    case 'ADMIN':
      return 'Administrator';
    case 'PM':
      return 'Project Manager';
    case 'CONTRIBUTOR':
      return 'Contributor';
    case 'VIEWER':
    default:
      return 'Viewer';
  }
}
