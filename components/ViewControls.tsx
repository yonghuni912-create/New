'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from './ui/Input';

interface Store {
  id: string;
  name: string;
  country: string;
}

interface ViewControlsProps {
  phases: string[];
  stores?: Store[];
  showStoreFilters?: boolean;
}

export default function ViewControls({ phases, stores = [], showStoreFilters = false }: ViewControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filterPhase = searchParams.get('phase') || '';
  const filterSearch = searchParams.get('search') || '';
  const mode = searchParams.get('mode') || 'ALL';
  const filterCountry = searchParams.get('country') || '';
  const filterStoreId = searchParams.get('storeId') || '';

  const countries = useMemo(() => {
    const set = new Set(stores.map(s => s.country));
    return Array.from(set).sort();
  }, [stores]);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Search */}
      <div className="flex-1 min-w-[200px]">
        <Input
          type="text"
          placeholder="Search tasks..."
          value={filterSearch}
          onChange={(e) => updateParam('search', e.target.value)}
          className="w-full"
        />
      </div>

      {/* Phase Filter */}
      <select
        value={filterPhase}
        onChange={(e) => updateParam('phase', e.target.value)}
        className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        <option value="">All Phases</option>
        {phases.map(p => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <div className="h-6 w-px bg-slate-200 hidden md:block" />

      {/* Mode Toggle */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
        <button
          onClick={() => updateParam('mode', 'ALL')}
          className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${mode === 'ALL' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          All Tasks
        </button>
        <button
          onClick={() => updateParam('mode', 'FOCUS')}
          className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${mode === 'FOCUS' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Focus
        </button>
      </div>

      {/* Country/Store Filters */}
      {showStoreFilters && stores.length > 0 && (
        <>
          <div className="h-6 w-px bg-slate-200 hidden md:block" />
          <select
            value={filterCountry}
            onChange={(e) => updateParam('country', e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">All Countries</option>
            {countries.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={filterStoreId}
            onChange={(e) => updateParam('storeId', e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">All Stores</option>
            {stores
              .filter(s => !filterCountry || s.country === filterCountry)
              .map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
          </select>
        </>
      )}
    </div>
  );
}
