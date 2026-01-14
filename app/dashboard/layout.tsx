'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  FileText,
  DollarSign,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
  Building2,
} from 'lucide-react';
import { useState } from 'react';
import { NotificationBell } from '@/components/NotificationBell';
import { GlobalSearch } from '@/components/GlobalSearch';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Stores', href: '/dashboard/stores', icon: Store },
  { name: 'Templates', href: '/dashboard/templates', icon: FileText },
  { name: 'Pricing', href: '/dashboard/pricing', icon: DollarSign },
  { name: 'Vendors', href: '/dashboard/vendors', icon: Building2 },
  { name: 'Admin', href: '/dashboard/admin', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:relative lg:flex-shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-6 bg-gradient-to-r from-orange-500 to-red-500">
            <h1 className="text-white font-bold text-lg">BBQ Chicken</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-orange-50 text-orange-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t">
            <div className="mb-4 px-4">
              <p className="text-sm font-medium text-gray-900">
                {session?.user?.name}
              </p>
              <p className="text-xs text-gray-500">{session?.user?.email}</p>
              <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded">
                {(session?.user as any)?.role}
              </span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header with notification bell and search */}
        <div className="sticky top-0 z-10 flex items-center justify-between h-12 bg-white border-b border-gray-200 px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="hidden lg:flex items-center">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-4">
            <div className="lg:hidden">
              <GlobalSearch />
            </div>
            <NotificationBell />
          </div>
        </div>

        <main className="flex-1 p-4 lg:px-8 lg:py-4">{children}</main>
      </div>
    </div>
  );
}
