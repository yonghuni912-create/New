'use client';

import { signOut, useSession } from 'next-auth/react';
import { Button } from './ui/Button';
import { NotificationBell } from './NotificationBell';
import { GlobalSearch } from './GlobalSearch';
import { LogOut, User } from 'lucide-react';

export function Header() {
  const { data: session } = useSession();
  const user = session?.user as any;

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
      <div className="flex items-center flex-1">
        <GlobalSearch />
      </div>

      <div className="flex items-center space-x-4">
        <NotificationBell />
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-md">
            <User className="h-4 w-4 text-gray-600" />
            <div className="text-sm">
              <div className="font-medium">{user?.name}</div>
              <div className="text-xs text-gray-500">{user?.role}</div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
