'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function StoreFilters({ countries }: { countries: any[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/dashboard/stores?${params.toString()}`);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search
          </label>
          <input
            type="text"
            defaultValue={searchParams.get('search') || ''}
            placeholder="Search stores..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Country
          </label>
          <select
            defaultValue={searchParams.get('country') || ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            onChange={(e) => handleFilterChange('country', e.target.value)}
          >
            <option value="">All Countries</option>
            {countries.map((country) => (
              <option key={country.id} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            defaultValue={searchParams.get('status') || ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="PLANNING">Planning</option>
            <option value="CONTRACT_SIGNED">Contract Signed</option>
            <option value="CONSTRUCTION">Construction</option>
            <option value="PRE_OPENING">Pre-Opening</option>
            <option value="OPEN">Open</option>
          </select>
        </div>
      </div>
    </div>
  );
}
