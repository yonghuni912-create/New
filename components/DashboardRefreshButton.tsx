'use client';

import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { useState, useTransition } from 'react';

export default function DashboardRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
      title="새로고침"
    >
      <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">새로고침</span>
    </button>
  );
}
