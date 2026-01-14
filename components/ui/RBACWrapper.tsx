'use client';

import { useSession } from 'next-auth/react';
import { hasPermission, Permission, canAccessRoute } from '@/lib/rbac';
import { usePathname } from 'next/navigation';

interface RBACWrapperProps {
  children: React.ReactNode;
  permission?: keyof Permission;
  requiredRole?: string | string[];
  fallback?: React.ReactNode;
  showAccessDenied?: boolean;
}

export default function RBACWrapper({
  children,
  permission,
  requiredRole,
  fallback = null,
  showAccessDenied = false,
}: RBACWrapperProps) {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;

  let hasAccess = true;

  // Check permission
  if (permission) {
    hasAccess = hasPermission(userRole, permission);
  }

  // Check required role
  if (requiredRole && hasAccess) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    hasAccess = roles.some(
      (role) => role.toUpperCase() === userRole?.toUpperCase()
    );
  }

  if (!hasAccess) {
    if (showAccessDenied) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
          <p className="text-red-600 font-medium">Access Denied</p>
          <p className="text-sm text-red-500 mt-1">
            You don't have permission to view this content.
          </p>
        </div>
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Hook for checking permissions in components
export function useRBAC() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const userRole = (session?.user as any)?.role;

  return {
    role: userRole,
    hasPermission: (permission: keyof Permission) =>
      hasPermission(userRole, permission),
    canAccessRoute: (route: string) => canAccessRoute(userRole, route),
    canAccessCurrentRoute: () => canAccessRoute(userRole, pathname || ''),
    isAdmin: userRole?.toUpperCase() === 'ADMIN',
    isPM: ['ADMIN', 'PM'].includes(userRole?.toUpperCase() || ''),
    isContributor: ['ADMIN', 'PM', 'CONTRIBUTOR'].includes(
      userRole?.toUpperCase() || ''
    ),
  };
}
