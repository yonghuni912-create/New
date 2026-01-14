'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import StoreCard from '@/components/StoreCard';
import StoreFilters from '@/components/StoreFilters';
import { Plus, LayoutGrid, Table as TableIcon, ChevronUp, ChevronDown } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

interface Store {
  id: string;
  tempName: string | null;
  officialName: string | null;
  country: string;
  city: string | null;
  address: string | null;
  timezone: string;
  storePhone: string | null;
  storeEmail: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  ownerAddress: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  plannedOpenDates: Array<{
    id: string;
    date: Date;
    reason: string | null;
  }>;
}
interface Country {
  id: string;
  name: string;
  code: string;
}



function StoresPageContent() {
  const searchParams = useSearchParams();
  const [stores, setStores] = useState<Store[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  
  // Sorting state
  const [sortField, setSortField] = useState<'name' | 'country' | 'city' | 'status' | 'openDate' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams();
        const country = searchParams.get('country');
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        
        if (country) params.append('country', country);
        if (status) params.append('status', status);
        if (search) params.append('search', search);
        
        const [storesRes, countriesRes] = await Promise.all([
          fetch(`/api/stores?${params.toString()}`),
          fetch('/api/stores?countriesOnly=true')
        ]);
        
        if (storesRes.ok) {
          const data = await storesRes.json();
          setStores(data.stores || data);
        }
        
        if (countriesRes.ok) {
          const data = await countriesRes.json();
          setCountries(data.countries || []);
        }
      } catch (error) {
        console.error('Failed to fetch stores:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [searchParams]);

  const filteredAndSortedStores = useMemo(() => {
    let result = [...stores];
    
    // Apply sorting
    if (sortField && viewMode === 'table') {
      result.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        switch (sortField) {
          case 'name':
            aValue = a.officialName || a.tempName || '';
            bValue = b.officialName || b.tempName || '';
            break;
          case 'country':
            aValue = a.country || '';
            bValue = b.country || '';
            break;
          case 'city':
            aValue = a.city || '';
            bValue = b.city || '';
            break;
          case 'status':
            aValue = a.status || '';
            bValue = b.status || '';
            break;
          case 'openDate':
            aValue = a.plannedOpenDates[0]?.date ? new Date(a.plannedOpenDates[0].date) : new Date(0);
            bValue = b.plannedOpenDates[0]?.date ? new Date(b.plannedOpenDates[0].date) : new Date(0);
            break;
          default:
            aValue = '';
            bValue = '';
        }
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [stores, sortField, sortDirection, viewMode]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 inline ml-1" />
      : <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

    return (
      <Suspense>
        <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stores</h1>
          <p className="text-gray-600 mt-2">
            Manage your store launches across all countries
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'card' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              카드
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'table' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              테이블
            </button>
          </div>
          
          <Link
            href="/dashboard/stores/new"
            className="flex items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Store
          </Link>
        </div>
      </div>

      <StoreFilters countries={countries} />

      {filteredAndSortedStores.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No stores found
          </h3>
          <p className="text-gray-500 mb-6">
            Get started by creating your first store.
          </p>
          <Link
            href="/dashboard/stores/new"
            className="inline-flex items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Store
          </Link>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredAndSortedStores.map((store) => {
            // Convert date strings to Date objects for StoreCard compatibility
            const normalizedStore = {
              ...store,
              createdAt: typeof store.createdAt === 'string' ? new Date(store.createdAt) : store.createdAt,
              updatedAt: typeof store.updatedAt === 'string' ? new Date(store.updatedAt) : store.updatedAt,
              plannedOpenDates: store.plannedOpenDates?.map((pod) => ({
                ...pod,
                date: typeof pod.date === 'string' ? new Date(pod.date) : pod.date,
              })) || [],
            };
            return <StoreCard key={store.id} store={normalizedStore} />;
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th onClick={() => handleSort('name')} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                    매장명 <SortIcon field="name" />
                  </th>
                  <th onClick={() => handleSort('country')} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                    국가 <SortIcon field="country" />
                  </th>
                  <th onClick={() => handleSort('city')} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                    도시 <SortIcon field="city" />
                  </th>
                  <th onClick={() => handleSort('status')} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                    상태 <SortIcon field="status" />
                  </th>
                  <th onClick={() => handleSort('openDate')} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                    오픈 예정일 <SortIcon field="openDate" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    연락처
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedStores.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/stores/${store.id}`} className="font-medium text-gray-900 hover:text-orange-600">
                        {store.officialName || store.tempName || 'Unnamed Store'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{store.country}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{store.city || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        store.status === 'PLANNING'
                          ? 'bg-blue-100 text-blue-800'
                          : store.status === 'CONTRACT_SIGNED'
                          ? 'bg-purple-100 text-purple-800'
                          : store.status === 'CONSTRUCTION'
                          ? 'bg-yellow-100 text-yellow-800'
                          : store.status === 'PRE_OPENING'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {store.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {store.plannedOpenDates[0]?.date 
                        ? new Date(store.plannedOpenDates[0].date).toLocaleDateString()
                        : '-'
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {store.ownerName && <div>{store.ownerName}</div>}
                      {store.ownerPhone && <div className="text-gray-500">{store.ownerPhone}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link 
                        href={`/dashboard/stores/${store.id}`}
                        className="text-orange-600 hover:text-orange-900 text-sm font-medium"
                      >
                        상세보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t flex justify-between items-center">
            <span className="text-sm text-gray-500">{filteredAndSortedStores.length}개 매장</span>
          </div>
        </div>
      )}

      </div>
    </Suspense>
  );
}

export default function StoresPage() {
  return (
    <Suspense>
      <StoresPageContent />
    </Suspense>
  );
}
