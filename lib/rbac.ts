// Role-Based Access Control utilities

export type Role = 'MASTER_ADMIN' | 'ADMIN' | 'PM' | 'CONTRIBUTOR' | 'VIEWER';

export interface Permission {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPermanentDelete: boolean;
  canManageUsers: boolean;
  canManageRoles: boolean;
  canManageSettings: boolean;
  canApprove: boolean;
  canExport: boolean;
}

const rolePermissions: Record<Role, Permission> = {
  MASTER_ADMIN: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canPermanentDelete: true,
    canManageUsers: true,
    canManageRoles: true,
    canManageSettings: true,
    canApprove: true,
    canExport: true,
  },
  ADMIN: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canPermanentDelete: false,
    canManageUsers: true,
    canManageRoles: false,
    canManageSettings: true,
    canApprove: true,
    canExport: true,
  },
  PM: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canPermanentDelete: false,
    canManageUsers: false,
    canManageRoles: false,
    canManageSettings: false,
    canApprove: true,
    canExport: true,
  },
  CONTRIBUTOR: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canPermanentDelete: false,
    canManageUsers: false,
    canManageRoles: false,
    canManageSettings: false,
    canApprove: false,
    canExport: true,
  },
  VIEWER: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canPermanentDelete: false,
    canManageUsers: false,
    canManageRoles: false,
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

  // Master Admin only routes
  const masterAdminRoutes = ['/dashboard/admin/roles'];
  if (masterAdminRoutes.some((r) => route.startsWith(r))) {
    return role?.toUpperCase() === 'MASTER_ADMIN';
  }

  // Admin-only routes
  const adminRoutes = ['/dashboard/admin'];
  if (adminRoutes.some((r) => route.startsWith(r))) {
    return ['MASTER_ADMIN', 'ADMIN'].includes(role?.toUpperCase() || '');
  }

  // PM or higher routes
  const pmRoutes = ['/dashboard/stores/new'];
  if (pmRoutes.some((r) => route.startsWith(r))) {
    return ['MASTER_ADMIN', 'ADMIN', 'PM'].includes(role?.toUpperCase() || '');
  }

  return permissions.canView;
}

export function getRoleBadgeColor(role: string | undefined | null): string {
  switch (role?.toUpperCase()) {
    case 'MASTER_ADMIN':
      return 'bg-purple-100 text-purple-800';
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
    case 'MASTER_ADMIN':
      return 'Master Admin';
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

// Check if user is Master Admin
export function isMasterAdmin(role: string | undefined | null): boolean {
  return role?.toUpperCase() === 'MASTER_ADMIN';
}

// Get all available roles (for role management)
export function getAllRoles(): { value: Role; label: string }[] {
  return [
    { value: 'MASTER_ADMIN', label: 'Master Admin' },
    { value: 'ADMIN', label: 'Administrator' },
    { value: 'PM', label: 'Project Manager' },
    { value: 'CONTRIBUTOR', label: 'Contributor' },
    { value: 'VIEWER', label: 'Viewer' },
  ];
}

// Get roles that can be assigned by the current user
export function getAssignableRoles(currentUserRole: string | undefined | null): { value: Role; label: string }[] {
  const allRoles = getAllRoles();
  
  if (currentUserRole?.toUpperCase() === 'MASTER_ADMIN') {
    // Master Admin can assign all roles except MASTER_ADMIN
    return allRoles.filter(r => r.value !== 'MASTER_ADMIN');
  }
  
  if (currentUserRole?.toUpperCase() === 'ADMIN') {
    // Admin can only assign PM, CONTRIBUTOR, VIEWER
    return allRoles.filter(r => ['PM', 'CONTRIBUTOR', 'VIEWER'].includes(r.value));
  }
  
  return [];
}
