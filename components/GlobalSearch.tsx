'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Input } from './ui/Input';
import { useRouter } from 'next/navigation';
import { debounce } from '@/lib/utils';

interface SearchResult {
  stores: any[];
  manuals: any[];
  ingredients: any[];
}

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const performSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults(null);
        return;
      }

      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (error) {
        console.error('Search failed:', error);
      }
    }, 300),
    []
  );

  useEffect(() => {
    performSearch(query);
  }, [query, performSearch]);

  const handleSelect = (type: string, id: string) => {
    setIsOpen(false);
    setQuery('');
    if (type === 'store') {
      router.push(`/dashboard/stores/${id}`);
    }
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search stores, manuals, ingredients..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10"
        />
      </div>

      {isOpen && results && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 right-0 z-20 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto">
            {results.stores.length > 0 && (
              <div className="p-2">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500">Stores</div>
                {results.stores.map((store) => (
                  <div
                    key={store.id}
                    onClick={() => handleSelect('store', store.id)}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer rounded"
                  >
                    <div className="font-medium text-sm">{store.storeName}</div>
                    <div className="text-xs text-gray-500">{store.storeCode}</div>
                  </div>
                ))}
              </div>
            )}

            {results.manuals.length > 0 && (
              <div className="p-2 border-t">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500">Manuals</div>
                {results.manuals.map((manual) => (
                  <div
                    key={manual.id}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer rounded"
                  >
                    <div className="font-medium text-sm">{manual.menuNameEn}</div>
                    <div className="text-xs text-gray-500">{manual.menuCode}</div>
                  </div>
                ))}
              </div>
            )}

            {results.ingredients.length > 0 && (
              <div className="p-2 border-t">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500">Ingredients</div>
                {results.ingredients.map((ingredient) => (
                  <div
                    key={ingredient.id}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer rounded"
                  >
                    <div className="font-medium text-sm">{ingredient.nameEn}</div>
                    <div className="text-xs text-gray-500">{ingredient.code}</div>
                  </div>
                ))}
              </div>
            )}

            {results.stores.length === 0 &&
              results.manuals.length === 0 &&
              results.ingredients.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No results found
                </div>
              )}
          </div>
        </>
      )}
    </div>
  );
}
