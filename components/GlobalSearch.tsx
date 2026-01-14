'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Store, FileText, Package, ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  type: 'store' | 'manual' | 'ingredient';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Handle keyboard shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Search debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch (error) {
        console.error('Search failed:', error);
      }
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = useCallback((result: SearchResult) => {
    router.push(result.href);
    setIsOpen(false);
  }, [router]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'store':
        return <Store className="w-5 h-5 text-orange-500" />;
      case 'manual':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'ingredient':
        return <Package className="w-5 h-5 text-green-500" />;
      default:
        return <Search className="w-5 h-5 text-gray-400" />;
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">검색</span>
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-mono bg-white border rounded shadow-sm">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-start justify-center pt-[15vh] px-4">
        <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center border-b">
            <Search className="w-5 h-5 ml-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="매장, 매뉴얼, 식재료 검색..."
              className="flex-1 px-4 py-4 text-lg outline-none"
            />
            {isLoading && <Loader2 className="w-5 h-5 mr-4 text-gray-400 animate-spin" />}
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 mr-2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Results */}
          {results.length > 0 ? (
            <ul className="max-h-[60vh] overflow-y-auto py-2">
              {results.map((result, index) => (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    onClick={() => handleSelect(result)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      index === selectedIndex ? 'bg-gray-50' : ''
                    }`}
                  >
                    {getIcon(result.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {result.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {result.subtitle}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim() && !isLoading ? (
            <div className="py-12 text-center text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>'{query}'에 대한 검색 결과가 없습니다</p>
            </div>
          ) : !query.trim() ? (
            <div className="py-8 px-4">
              <p className="text-sm text-gray-500 text-center mb-4">최근 검색</p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 text-sm bg-gray-100 rounded-full text-gray-600">
                  매장
                </span>
                <span className="px-3 py-1 text-sm bg-gray-100 rounded-full text-gray-600">
                  매뉴얼
                </span>
                <span className="px-3 py-1 text-sm bg-gray-100 rounded-full text-gray-600">
                  식재료
                </span>
              </div>
            </div>
          ) : null}

          {/* Footer */}
          <div className="px-4 py-2 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white border rounded">↑↓</kbd>
                이동
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white border rounded">Enter</kbd>
                선택
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white border rounded">Esc</kbd>
                닫기
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
